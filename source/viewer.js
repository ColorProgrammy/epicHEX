// viewer.js
const blessed = require('blessed');
const fs = require('fs');
const { EHEXImage } = require('./main.js');

class EHEXViewer {
    constructor(filename = null) {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'EpicHEX Image Viewer'
        });

        this.currentImage = new EHEXImage(20, 10);
        this.filename = filename;
        this.fitMode = false;

        this.initUI();

        // Load file if provided via command line
        if (this.filename && fs.existsSync(this.filename)) {
            this.loadImage(this.filename);
        } else {
            // Try to load any .ehex file
            const ehexFiles = fs.readdirSync('.').filter(f => f.endsWith('.ehex'));
            if (ehexFiles.length > 0) {
                this.loadImage(ehexFiles[0]);
            }
        }

        this.bindEvents();
    }

    initUI() {
        // Header
        this.header = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } },
            content: ' EpicHEX Image Viewer | F10 - Quit F11 - Fit | Drag .ehex files to view | Made by ColorProgrammy '
        });

        // Image display with green border
        this.imageBox = blessed.box({
            parent: this.screen,
            border: { type: 'line' },
            style: { border: { fg: 'green' } }
        });

        this.canvas = blessed.box({
            parent: this.imageBox,
            top: 1,
            left: 1,
            content: ''
        });

        // Info panel
        this.infoPanel = blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 6,
            border: { type: 'line' },
            style: { border: { fg: 'yellow' } },
            content: 'No image loaded\n\nDrag .ehex files onto the viewer window'
        });

        // Set initial layout
        this.updateLayout();
    }

    bindEvents() {
        this.screen.key(['C-c', 'f10'], () => {
            this.screen.destroy();
            process.exit(0);
        });
        
        this.screen.key(['f11'], () => this.toggleFitMode());
    }

    loadImage(filename) {
        try {
            this.filename = filename;
            this.currentImage.load(this.filename);
            this.updateLayout();
            this.updateDisplay();
            this.updateInfo();
        } catch (error) {
            this.infoPanel.setContent(` Error loading ${filename}: ${error.message} `);
            this.screen.render();
        }
    }

    updateLayout() {
        if (this.fitMode) {
            // Fit mode: hide header and info, resize imageBox to fit image exactly
            this.header.hide();
            this.infoPanel.hide();
            
            this.imageBox.width = this.currentImage.width + 4;
            this.imageBox.height = this.currentImage.height + 4;
            this.imageBox.top = 'center';
            this.imageBox.left = 'center';
            
            this.canvas.width = this.currentImage.width;
            this.canvas.height = this.currentImage.height;
            
            this.screen.title = `EpicHEX Viewer - ${this.filename} (${this.currentImage.width}x${this.currentImage.height})`;
        } else {
            // Normal mode: show header and info
            this.header.show();
            this.infoPanel.show();
            
            // Calculate display size that fits on screen
            const maxWidth = Math.min(this.currentImage.width, this.screen.width - 10);
            const maxHeight = Math.min(this.currentImage.height, this.screen.height - 15);
            
            this.imageBox.width = maxWidth + 4;
            this.imageBox.height = maxHeight + 4;
            this.imageBox.top = 3;
            this.imageBox.left = 'center';
            
            this.canvas.width = maxWidth;
            this.canvas.height = maxHeight;
            
            this.screen.title = 'EpicHEX Image Viewer v1.1';
        }
    }

    toggleFitMode() {
        this.fitMode = !this.fitMode;
        this.updateLayout();
        this.updateDisplay();
        this.updateInfo();
        this.screen.render();
    }

    updateDisplay() {
        let display = '';
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        for (let y = 0; y < height; y++) {
            let line = '';
            for (let x = 0; x < width; x++) {
                if (y < this.currentImage.height && x < this.currentImage.width) {
                    const charIndex = this.currentImage.getPixel(x, y);
                    line += this.currentImage.chars[charIndex];
                } else {
                    line += ' '; // Fill with spaces if beyond image bounds
                }
            }
            display += line + '\n';
        }
        this.canvas.setContent(display);
        this.screen.render();
    }

    updateInfo() {
        if (!this.fitMode) {
            const displayWidth = Math.min(this.currentImage.width, this.canvas.width);
            const displayHeight = Math.min(this.currentImage.height, this.canvas.height);
            const displayInfo = displayWidth < this.currentImage.width || displayHeight < this.currentImage.height ? 
                `Display: ${displayWidth}x${displayHeight} (cropped)` : `Display: ${displayWidth}x${displayHeight}`;
                
            const info = `Image: ${this.filename}\nSize: ${this.currentImage.width}x${this.currentImage.height}\nFormat: EHEX v${this.currentImage.version}`;
            const controls = `\nPress F11 to toggle fit mode\nPress F10 or Ctrl+C to quit`;
            this.infoPanel.setContent(`${info}\n${displayInfo}${controls}`);
        }
        this.screen.render();
    }

    run() {
        this.updateDisplay();
        this.updateInfo();
        this.screen.render();
    }
}

// Main execution
if (require.main === module) {
    const filename = process.argv[2] || null;
    
    try {
        require('blessed');
    } catch (e) {
        console.log('Installing blessed library...');
        const { execSync } = require('child_process');
        execSync('npm install blessed', { stdio: 'inherit' });
    }
    
    const viewer = new EHEXViewer(filename);
    viewer.run();
    
    console.log('EpicHEX Viewer v1.1 started!');
    console.log('Press F10 or Ctrl+C to quit, F11 to toggle fit mode');
}