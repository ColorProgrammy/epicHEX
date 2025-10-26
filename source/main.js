// main.js - EpicHEX Image Format System v1.1
const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

// EHEX v2 Image Format Implementation
class EHEXImage {
    constructor(width = 20, height = 10) {
        this.magic = 'EHEX2';
        this.version = 2;
        this.width = Math.min(width, 150);
        this.height = Math.min(height, 25);
        this.chars = this.createDefaultCharset();
        this.pixels = this.createEmptyPixels();
    }

    createDefaultCharset() {
        // Characters from simple to complex
        return [' ', '.', ':', '-', '=', '+', '*', '#', '%', '&', '$', '@', 'Q', 'W', 'M', '█'];
    }

    createEmptyPixels() {
        const pixels = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(0); // Default to space character
            }
            pixels.push(row);
        }
        return pixels;
    }

    setPixel(x, y, charIndex) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.pixels[y][x] = charIndex;
        }
    }

    getPixel(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.pixels[y][x];
        }
        return 0;
    }

    encode() {
        let data = `${this.magic}\n`;
        data += `V${this.version}\n`;
        data += `SIZE:${this.width}x${this.height}\n`;
        data += 'PIXELS:\n';

        for (let y = 0; y < this.height; y++) {
            let rowData = '';
            for (let x = 0; x < this.width; x++) {
                // Each pixel: char (1 hex digit)
                rowData += this.pixels[y][x].toString(16);
            }
            data += rowData + '\n';
        }

        return data;
    }

    decode(data) {
        const lines = data.split('\n');
        const magic = lines[0];
        
        if (magic !== 'EHEX2' && magic !== 'EHEX') {
            throw new Error('Invalid EHEX file');
        }

        if (magic === 'EHEX') {
            throw new Error('EHEX v1 files are not supported. Please convert to v2 format.');
        }

        // Parse header for v2
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('V')) {
                const version = parseInt(line.substring(1));
                if (version !== 2) {
                    throw new Error(`Unsupported EHEX version: ${version}`);
                }
            } else if (line.startsWith('SIZE:')) {
                const size = line.substring(5).split('x');
                this.width = parseInt(size[0]);
                this.height = parseInt(size[1]);
            } else if (line === 'PIXELS:') {
                this.parsePixels(lines.slice(i + 1));
                break;
            }
        }
    }

    parsePixels(pixelLines) {
        this.pixels = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            const line = pixelLines[y];
            for (let x = 0; x < this.width; x++) {
                const charIndex = parseInt(line[x], 16);
                row.push(charIndex);
            }
            this.pixels.push(row);
        }
    }

    resize(newWidth, newHeight) {
        // Apply limits
        newWidth = Math.min(newWidth, 150);
        newHeight = Math.min(newHeight, 25);
        
        const newPixels = [];
        for (let y = 0; y < newHeight; y++) {
            const row = [];
            for (let x = 0; x < newWidth; x++) {
                if (y < this.height && x < this.width) {
                    row.push(this.pixels[y][x]);
                } else {
                    row.push(0); // Fill with space
                }
            }
            newPixels.push(row);
        }
        this.pixels = newPixels;
        this.width = newWidth;
        this.height = newHeight;
    }

    save(filename) {
        const data = this.encode();
        fs.writeFileSync(filename, data);
    }

    load(filename) {
        const data = fs.readFileSync(filename, 'utf8');
        this.decode(data);
    }
}

// Terminal-based Image Viewer and Painter
class EHEXApp {
    constructor(filename = null) {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'EpicHEX Image Editor v1.1'
        });

        this.currentImage = new EHEXImage(20, 10);
        this.filename = filename;
        this.currentChar = 1; // Start with dot
        this.brushSize = 1;
        this.cursorX = 0;
        this.cursorY = 0;
        this.showResizePanel = false;
        this.resizeWidth = 20;
        this.resizeHeight = 10;
        this.resizeStep = 'width'; // 'width' or 'height'

        this.initUI();
        this.bindEvents();

        // Load file if provided via command line
        if (this.filename && fs.existsSync(this.filename)) {
            this.loadImage(this.filename);
        }
    }

    initUI() {
        // Main layout
        this.layout = blessed.layout({
            parent: this.screen,
            width: '100%',
            height: '100%',
            layout: 'grid'
        });

        // Toolbar
        this.toolbar = blessed.box({
            parent: this.layout,
            width: '100%',
            height: 3,
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } },
            content: ' EpicHEX Editor v1.1 | F1 - New S - Save L - Load C - Char B - Brush R - Resize F10 - Quit | Made by ColorProgrammy '
        });

        // Canvas area with green border
        this.canvasBox = blessed.box({
            parent: this.layout,
            width: this.currentImage.width + 1,
            height: this.currentImage.height + 1,
            border: { type: 'line' },
            style: { border: { fg: 'green' } }
        });

        // Image display
        this.canvas = blessed.box({
            parent: this.canvasBox,
            top: 1,
            left: 1,
            width: this.currentImage.width,
            height: this.currentImage.height,
            content: ''
        });

        // Info panel
        this.infoPanel = blessed.box({
            parent: this.layout,
            width: 30,
            height: '80%',
            border: { type: 'line' },
            style: { border: { fg: 'yellow' } },
            content: 'Info:\n\nSize: 20x10\nFormat: EHEX v2\n\nDrag .ehex files here'
        });

        // Status bar
        this.statusBar = blessed.box({
            parent: this.layout,
            width: '100%',
            height: 3,
            border: { type: 'line' },
            style: { border: { fg: 'magenta' } },
            content: ' Ready | X:0 Y:0 | Char: . (1) | Brush: 1x1 '
        });

        // Resize panel (hidden by default)
        this.resizePanel = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 40,
            height: 8,
            hidden: true,
            border: { type: 'line' },
            style: { border: { fg: 'blue' } },
            content: ' Resize Canvas - Enter Width (1-150): '
        });

        this.resizeInput = blessed.textbox({
            parent: this.resizePanel,
            top: 3,
            left: 2,
            width: 36,
            height: 1,
            inputOnFocus: true
        });
    }

    bindEvents() {
        // Keyboard events with new hotkeys
        this.screen.key(['C-c', 'f10'], () => {
            this.screen.destroy();
            process.exit(0);
        });
        
        this.screen.key(['q'], () => {
            // Don't quit on Q, only on F10 or Ctrl+C
        });
        
        this.screen.key(['f1'], () => this.newImage());
        this.screen.key(['s'], () => this.saveImage());
        this.screen.key(['l'], () => this.loadImage());
        this.screen.key(['c'], () => this.changeChar());
        this.screen.key(['b'], () => this.changeBrushSize());
        this.screen.key(['r'], () => this.showResizeDialog());

        // Mouse events for painting
        this.canvasBox.on('click', (data) => {
            this.handleCanvasClick(data);
        });

        // Cursor movement
        this.screen.key(['up'], () => this.moveCursor(0, -1));
        this.screen.key(['down'], () => this.moveCursor(0, 1));
        this.screen.key(['left'], () => this.moveCursor(-1, 0));
        this.screen.key(['right'], () => this.moveCursor(1, 0));
        this.screen.key(['space'], () => this.paintAtCursor());

        // Resize panel events
        this.resizeInput.on('submit', () => this.handleResizeInput());
        this.resizeInput.key(['escape'], () => this.hideResizeDialog());
    }

    moveCursor(dx, dy) {
        const newX = this.cursorX + dx;
        const newY = this.cursorY + dy;
        
        if (newX >= 0 && newX < this.currentImage.width && 
            newY >= 0 && newY < this.currentImage.height) {
            this.cursorX = newX;
            this.cursorY = newY;
            this.updateDisplay();
            this.updateStatus();
            this.updateInfo();
        }
    }

    paintAtCursor() {
        for (let dy = 0; dy < this.brushSize; dy++) {
            for (let dx = 0; dx < this.brushSize; dx++) {
                const paintX = this.cursorX + dx;
                const paintY = this.cursorY + dy;
                
                if (paintX < this.currentImage.width && paintY < this.currentImage.height) {
                    this.currentImage.setPixel(paintX, paintY, this.currentChar);
                }
            }
        }
        this.updateDisplay();
    }

    handleCanvasClick(data) {
        if (this.showResizePanel) return;

        // Convert screen coordinates to image coordinates
        const x = data.x - this.canvasBox.left - 1;
        const y = data.y - this.canvasBox.top - 1;
        
        if (x >= 0 && x < this.currentImage.width && y >= 0 && y < this.currentImage.height) {
            this.cursorX = x;
            this.cursorY = y;
            this.updateStatus();
            this.updateInfo();
            this.paintAtCursor();
        }
    }

    updateDisplay() {
        let display = '';
        for (let y = 0; y < this.currentImage.height; y++) {
            let line = '';
            for (let x = 0; x < this.currentImage.width; x++) {
                const charIndex = this.currentImage.getPixel(x, y);
                const char = this.currentImage.chars[charIndex];
                
                if (x === this.cursorX && y === this.cursorY) {
                    line += 'X'; // Use X for cursor position
                } else {
                    line += char;
                }
            }
            display += line + '\n';
        }
        this.canvas.setContent(display);
        
        // Update canvas border to fit image
        this.canvasBox.width = this.currentImage.width + 4;
        this.canvasBox.height = this.currentImage.height + 4;
        this.canvas.width = this.currentImage.width;
        this.canvas.height = this.currentImage.height;
        
        this.screen.render();
    }

    updateStatus() {
        const currentChar = this.currentImage.chars[this.currentChar];
        const brushText = `${this.brushSize}x${this.brushSize}`;
        this.statusBar.setContent(` Ready | X:${this.cursorX} Y:${this.cursorY} | Char: ${currentChar} (${this.currentChar}) | Brush: ${brushText} `);
        this.screen.render();
    }

    updateInfo() {
        const maxSize = "Max: 150x25";
        const cursorInfo = `Cursor: X:${this.cursorX} Y:${this.cursorY}`;
        const brushInfo = `Brush: ${this.brushSize}x${this.brushSize}`;
        const charInfo = `Char: ${this.currentImage.chars[this.currentChar]} (${this.currentChar})`;
        
        this.infoPanel.setContent(`Info:\n\nSize: ${this.currentImage.width}x${this.currentImage.height}\n${maxSize}\nFormat: EHEX v${this.currentImage.version}\nFile: ${this.filename || 'Unsaved'}\n\n${cursorInfo}\n${brushInfo}\n${charInfo}`);
        this.screen.render();
    }

    saveImage() {
        if (!this.filename) {
            this.filename = `image_${Date.now()}.ehex`;
        }
        this.currentImage.save(this.filename);
        this.statusBar.setContent(` Saved: ${this.filename} `);
        this.updateInfo();
        this.screen.render();
    }

    loadImage(filename = null) {
        try {
            if (!filename) {
                // In a real implementation, you'd use a file dialog
                const testFiles = fs.readdirSync('.').filter(f => f.endsWith('.ehex'));
                if (testFiles.length > 0) {
                    filename = testFiles[0];
                } else {
                    this.statusBar.setContent(' No .ehex files found in current directory ');
                    this.screen.render();
                    return;
                }
            }
            
            this.filename = filename;
            this.currentImage.load(this.filename);
            this.cursorX = 0;
            this.cursorY = 0;
            this.updateDisplay();
            this.updateInfo();
            this.updateStatus();
            this.statusBar.setContent(` Loaded: ${this.filename} `);
        } catch (error) {
            this.statusBar.setContent(` Error: ${error.message} `);
        }
        this.screen.render();
    }

    newImage() {
        this.currentImage = new EHEXImage(20, 10);
        this.filename = null;
        this.cursorX = 0;
        this.cursorY = 0;
        this.updateDisplay();
        this.updateInfo();
        this.updateStatus();
    }

    changeChar() {
        // Cycle through characters 0-15
        this.currentChar = (this.currentChar + 1) % 16;
        this.updateStatus();
        this.updateInfo();
    }

    changeBrushSize() {
        this.brushSize = this.brushSize < 3 ? this.brushSize + 1 : 1;
        this.updateStatus();
        this.updateInfo();
    }

    showResizeDialog() {
        this.showResizePanel = true;
        this.resizeStep = 'width';
        this.resizePanel.setContent(' Resize Canvas - Enter Width (1-150): ');
        this.resizeInput.setValue('');
        this.resizePanel.show();
        this.resizeInput.focus();
        this.screen.render();
    }

    hideResizeDialog() {
        this.showResizePanel = false;
        this.resizePanel.hide();
        this.screen.render();
    }

    handleResizeInput() {
        const value = parseInt(this.resizeInput.value);
        
        if (this.resizeStep === 'width') {
            if (value > 0 && value <= 150) {
                this.resizeWidth = value;
                this.resizeStep = 'height';
                this.resizePanel.setContent(' Resize Canvas - Enter Height (1-25): ');
                this.resizeInput.setValue('');
                this.resizeInput.focus();
            } else {
                this.statusBar.setContent(' Error: Width must be between 1 and 150 ');
                this.hideResizeDialog();
            }
        } else if (this.resizeStep === 'height') {
            if (value > 0 && value <= 25) {
                this.resizeHeight = value;
                this.applyResize();
            } else {
                this.statusBar.setContent(' Error: Height must be between 1 and 25 ');
                this.hideResizeDialog();
            }
        }
        
        this.screen.render();
    }

    applyResize() {
        this.currentImage.resize(this.resizeWidth, this.resizeHeight);
        this.cursorX = Math.min(this.cursorX, this.resizeWidth - 1);
        this.cursorY = Math.min(this.cursorY, this.resizeHeight - 1);
        this.updateDisplay();
        this.updateInfo();
        this.updateStatus();
        this.statusBar.setContent(` Resized to ${this.resizeWidth}x${this.resizeHeight} `);
        this.hideResizeDialog();
    }

    run() {
        this.updateDisplay();
        this.updateInfo();
        this.updateStatus();
        this.screen.render();
    }
}

// Create a sample EHEX v2 file for testing
function createSampleEHEX() {
    const sample = new EHEXImage(8, 8);
    
    // Create a pattern
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const char = (x + y) % 16;
            sample.setPixel(x, y, char);
        }
    }
    
    sample.save('sample.ehex');
    console.log('Created sample.ehex');
}

// Main execution
if (require.main === module) {
    // Get filename from command line arguments
    const filename = process.argv[2] || null;
    
    // Create necessary files
    // createSampleEHEX();
    
    // Check if blessed is available
    try {
        require('blessed');
    } catch (e) {
        console.log('Installing blessed library...');
        const { execSync } = require('child_process');
        execSync('npm install blessed', { stdio: 'inherit' });
    }
    
    // Start the application
    const app = new EHEXApp(filename);
    app.run();
    
    console.log('EpicHEX Editor v1.1 started!');
    console.log('Use arrow keys to move, space to paint');
    console.log('Hotkeys: F1(New) S(Save) L(Load) C(Char) B(Brush) R(Resize) F10(Quit)');
    console.log('Canvas limit: 150x25 pixels');
}

module.exports = { EHEXImage, EHEXApp };