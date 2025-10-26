// main.js - EpicHEX Image Format System
const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

// EHEX Image Format Implementation
class EHEXImage {
    constructor(width = 100, height = 100) {
        this.magic = 'EHEX';
        this.version = 1;
        this.width = width;
        this.height = height;
        this.channels = 4; // RGBA
        this.pixels = this.createEmptyPixels();
    }

    createEmptyPixels() {
        const pixels = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push([0, 0, 0, 255]); // Black, fully opaque
            }
            pixels.push(row);
        }
        return pixels;
    }

    setPixel(x, y, r, g, b, a = 255) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.pixels[y][x] = [r, g, b, a];
        }
    }

    getPixel(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.pixels[y][x];
        }
        return [0, 0, 0, 0];
    }

    encode() {
        let data = `${this.magic}\n`;
        data += `V${this.version}\n`;
        data += `SIZE:${this.width}x${this.height}\n`;
        data += `CHANNELS:${this.channels}\n`;
        data += 'PIXELS:\n';

        for (let y = 0; y < this.height; y++) {
            let rowData = '';
            for (let x = 0; x < this.width; x++) {
                const [r, g, b, a] = this.pixels[y][x];
                rowData += this.rgbaToHex(r, g, b, a);
            }
            data += rowData + '\n';
        }

        return data;
    }

    decode(data) {
        const lines = data.split('\n');
        if (lines[0] !== 'EHEX') {
            throw new Error('Invalid EHEX file');
        }

        // Parse header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('V')) {
                this.version = parseInt(line.substring(1));
            } else if (line.startsWith('SIZE:')) {
                const size = line.substring(5).split('x');
                this.width = parseInt(size[0]);
                this.height = parseInt(size[1]);
            } else if (line.startsWith('CHANNELS:')) {
                this.channels = parseInt(line.substring(9));
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
                const hex = line.substring(x * 8, (x + 1) * 8);
                const rgba = this.hexToRgba(hex);
                row.push(rgba);
            }
            this.pixels.push(row);
        }
    }

    rgbaToHex(r, g, b, a) {
        return [
            r.toString(16).padStart(2, '0'),
            g.toString(16).padStart(2, '0'),
            b.toString(16).padStart(2, '0'),
            a.toString(16).padStart(2, '0')
        ].join('').toUpperCase();
    }

    hexToRgba(hex) {
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16),
            parseInt(hex.substring(6, 8), 16)
        ];
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
    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'EpicHEX Image Editor'
        });

        this.currentImage = new EHEXImage(20, 10);
        this.filename = null;
        this.currentColor = [255, 255, 255, 255]; // White
        this.brushSize = 1;
        this.cursorX = 0;
        this.cursorY = 0;

        this.initUI();
        this.bindEvents();
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
            content: ' EpicHEX Editor v1.01 | F1:Save F2:Load F3:New F4:Color F5:Brush F10:Quit | Made by ColorProgrammy '
        });

        // Canvas area
        this.canvasBox = blessed.box({
            parent: this.layout,
            width: '70%',
            height: '80%',
            border: { type: 'line' },
            style: { border: { fg: 'green' } }
        });

        // Image display
        this.canvas = blessed.box({
            parent: this.canvasBox,
            top: 1,
            left: 1,
            width: '100%-2',
            height: '100%-2',
            content: ''
        });

        // Info panel
        this.infoPanel = blessed.box({
            parent: this.layout,
            width: '30%',
            height: '80%',
            border: { type: 'line' },
            style: { border: { fg: 'yellow' } },
            content: 'Image Info\n\nSize: 20x10\nFormat: EHEX v1\n\nDrag .ehex files here'
        });

        // Status bar
        this.statusBar = blessed.box({
            parent: this.layout,
            width: '100%',
            height: 3,
            border: { type: 'line' },
            style: { border: { fg: 'magenta' } },
            content: ' Ready | X:0 Y:0 | Color: #FFFFFF | Brush: 1 '
        });

        // File drop handler
        this.dropZone = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 40,
            height: 10,
            hidden: true,
            border: { type: 'line' },
            style: { 
                border: { fg: 'red' },
                bg: 'blue'
            },
            content: ' DROP .ehex FILE HERE \n\nRelease to load file',
            tags: true
        });
    }

    bindEvents() {
        // Keyboard events
        this.screen.key(['C-c', 'q', 'f10'], () => process.exit(0));
        this.screen.key(['f1'], () => this.saveImage());
        this.screen.key(['f2'], () => this.loadImage());
        this.screen.key(['f3'], () => this.newImage());
        this.screen.key(['f4'], () => this.changeColor());
        this.screen.key(['f5'], () => this.changeBrushSize());

        // Mouse events for painting
        this.canvasBox.on('click', (data) => {
            this.handleCanvasClick(data);
        });

        // Drag and drop simulation
        this.screen.on('keypress', (ch, key) => {
            if (key.name === 'f6') {
                this.showDropZone();
            }
        });

        // Cursor movement
        this.screen.key(['up'], () => this.moveCursor(0, -1));
        this.screen.key(['down'], () => this.moveCursor(0, 1));
        this.screen.key(['left'], () => this.moveCursor(-1, 0));
        this.screen.key(['right'], () => this.moveCursor(1, 0));
        this.screen.key(['space'], () => this.paintAtCursor());
    }

    moveCursor(dx, dy) {
        this.cursorX = Math.max(0, Math.min(this.currentImage.width - 1, this.cursorX + dx));
        this.cursorY = Math.max(0, Math.min(this.currentImage.height - 1, this.cursorY + dy));
        this.updateDisplay();
        this.updateStatus();
    }

    paintAtCursor() {
        for (let dy = 0; dy < this.brushSize; dy++) {
            for (let dx = 0; dx < this.brushSize; dx++) {
                this.currentImage.setPixel(
                    this.cursorX + dx,
                    this.cursorY + dy,
                    ...this.currentColor
                );
            }
        }
        this.updateDisplay();
    }

    handleCanvasClick(data) {
        // Convert screen coordinates to image coordinates
        const x = Math.floor((data.x - 2) / 2);
        const y = data.y - 4;
        
        if (x >= 0 && x < this.currentImage.width && y >= 0 && y < this.currentImage.height) {
            this.cursorX = x;
            this.cursorY = y;
            this.paintAtCursor();
        }
    }

    updateDisplay() {
        let display = '';
        for (let y = 0; y < this.currentImage.height; y++) {
            let line = '';
            for (let x = 0; x < this.currentImage.width; x++) {
                const [r, g, b] = this.currentImage.getPixel(x, y);
                const char = this.getColorChar(r, g, b);
                
                if (x === this.cursorX && y === this.cursorY) {
                    line += `${char}`;
                } else {
                    line += char;
                }
            }
            display += line + '\n';
        }
        this.canvas.setContent(display);
        this.screen.render();
    }

    getColorChar(r, g, b) {
        // Convert RGB to grayscale for terminal display
        const brightness = (r + g + b) / 3;
        if (brightness < 50) return ' ';
        if (brightness < 100) return '.';
        if (brightness < 150) return '*';
        if (brightness < 200) return '#';
        return '@';
    }

    updateStatus() {
        const [r, g, b] = this.currentColor;
        const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        this.statusBar.setContent(` Ready | X:${this.cursorX} Y:${this.cursorY} | Color: ${colorHex} | Brush: ${this.brushSize} `);
        this.screen.render();
    }

    updateInfo() {
        this.infoPanel.setContent(`Image Info\n\nSize: ${this.currentImage.width}x${this.currentImage.height}\nFormat: EHEX v${this.currentImage.version}\nFile: ${this.filename || 'Unsaved'}`);
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

    loadImage() {
        // In a real implementation, you'd use a file dialog
        // For now, we'll simulate loading a test image
        const testFiles = fs.readdirSync('.').filter(f => f.endsWith('.ehex'));
        if (testFiles.length > 0) {
            this.filename = testFiles[0];
            this.currentImage.load(this.filename);
            this.updateDisplay();
            this.updateInfo();
            this.statusBar.setContent(` Loaded: ${this.filename} `);
        } else {
            this.statusBar.setContent(' No .ehex files found in current directory ');
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

    changeColor() {
        // Cycle through some basic colors
        const colors = [
            [255, 255, 255, 255], // White
            [255, 0, 0, 255],     // Red
            [0, 255, 0, 255],     // Green
            [0, 0, 255, 255],     // Blue
            [255, 255, 0, 255],   // Yellow
            [255, 0, 255, 255],   // Magenta
            [0, 255, 255, 255]    // Cyan
        ];
        
        const currentIndex = colors.findIndex(c => 
            c[0] === this.currentColor[0] && 
            c[1] === this.currentColor[1] && 
            c[2] === this.currentColor[2]
        );
        
        this.currentColor = colors[(currentIndex + 1) % colors.length];
        this.updateStatus();
    }

    changeBrushSize() {
        this.brushSize = this.brushSize < 3 ? this.brushSize + 1 : 1;
        this.updateStatus();
    }

    showDropZone() {
        this.dropZone.show();
        this.screen.render();
        
        // Simulate file drop timeout
        setTimeout(() => {
            this.dropZone.hide();
            this.loadImage(); // Load any available file
            this.screen.render();
        }, 2000);
    }

    run() {
        this.updateDisplay();
        this.updateInfo();
        this.screen.render();
    }
}

// Batch file creator
function createBatchFiles() {
    const batContent = `@echo off
echo Starting EpicHEX Image Editor...
node main.js
pause`;
    
    fs.writeFileSync('run.bat', batContent);
    console.log('Created run.bat');
}

// Create a sample EHEX file for testing
function createSampleEHEX() {
    const sample = new EHEXImage(8, 8);
    
    // Create a simple pattern
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const r = x * 32;
            const g = y * 32;
            const b = (x + y) * 16;
            sample.setPixel(x, y, r, g, b, 255);
        }
    }
    
    sample.save('sample.ehex');
    console.log('Created sample.ehex');
}

// Main execution
if (require.main === module) {
    // Create necessary files
    createBatchFiles();
    createSampleEHEX();
    
    // Check if blessed is available
    try {
        require('blessed');
    } catch (e) {
        console.log('Installing blessed library...');
        const { execSync } = require('child_process');
        execSync('npm install blessed', { stdio: 'inherit' });
    }
    
    // Start the application
    const app = new EHEXApp();
    app.run();
    
    console.log('EpicHEX Editor started!');
    console.log('Use arrow keys to move, space to paint');
    console.log('Function keys: F1(Save) F2(Load) F3(New) F4(Color) F5(Brush) F10(Quit)');
}

module.exports = { EHEXImage, EHEXApp };