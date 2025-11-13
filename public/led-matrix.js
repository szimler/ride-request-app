// ============================================
// LED MATRIX DISPLAY - True Pixel-Based LED Sign
// Like "GO BLAZERS!" with visible individual LEDs!
// ============================================

class LEDMatrix {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // LED Matrix configuration
        this.ledSize = options.ledSize || 4;           // Size of each LED pixel
        this.ledSpacing = options.ledSpacing || 1.5;   // Space between LEDs
        this.rows = options.rows || 7;                  // Height in pixels (7 pixels tall)
        this.cols = options.cols || 80;                 // Width in pixels
        
        // Calculate actual canvas size
        this.pixelWidth = this.ledSize + this.ledSpacing;
        this.canvas.width = this.cols * this.pixelWidth;
        this.canvas.height = this.rows * this.pixelWidth;
        
        // Display properties
        this.brightness = 1.0;
        this.scrollPosition = 0;
        this.scrollSpeed = 0.5; // SLOWER - was 1, now 0.5
        this.scrollDirection = 'horizontal';
        this.currentMessage = '';
        this.messagePixels = [];
        
        // Color mode
        this.colorMode = 'rainbow';  // 'rainbow', 'solid', 'gradient'
        this.baseColor = { r: 0, g: 255, b: 0 };  // Default green
        this.currentTextColor = '#00FF00';  // Current message text color
        this.currentBgColor = '#000000';    // Current message background color
        
        // Animation
        this.animationFrame = null;
        this.isScrolling = false;
        
        // Pause logic
        this.pauseDuration = 2000; // 2 seconds pause between loops
        this.isPaused = false;
        this.loopCount = 0;
        
        // Message sequence support
        this.messageSequence = [];
        this.currentMessageIndex = 0;
        this.isPlayingSequence = false;
        
        // Initialize
        this.initializeEmojis();
        this.initializeFont();
    }
    
    // Play a sequence of messages
    playMessageSequence(messages) {
        if (!messages || messages.length === 0) return;
        
        console.log(`🎬 Starting message sequence with ${messages.length} messages`);
        this.messageSequence = messages;
        this.currentMessageIndex = 0;
        this.isPlayingSequence = true;
        
        // Play first message
        this.playNextInSequence();
    }
    
    // Play next message in sequence
    playNextInSequence() {
        if (!this.isPlayingSequence || this.messageSequence.length === 0) return;
        
        const msg = this.messageSequence[this.currentMessageIndex];
        console.log(`📺 Playing message ${this.currentMessageIndex + 1}/${this.messageSequence.length}: "${msg.text}"`);
        console.log(`   Direction: ${msg.direction}, Speed: ${msg.speed}x, Pause: ${msg.pause}ms`);
        
        // IMPORTANT: Advance index BEFORE playing (so the loop callback knows which is next)
        this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messageSequence.length;
        console.log(`   Next message will be: ${this.currentMessageIndex + 1}`);
        
        // Set message-specific settings and play
        this.setSpeed(msg.speed);
        this.setPauseDuration(msg.pause);
        const colorMode = msg.colorMode || 'solid';
        this.setMessage(msg.text, 'horizontal', colorMode, msg.direction, msg.textColor, msg.bgColor);
    }
    
    // Stop sequence playback
    stopSequence() {
        this.isPlayingSequence = false;
        this.messageSequence = [];
        this.currentMessageIndex = 0;
        this.stopScrolling();
    }
    
    // 7x7 LED Emojis (each emoji is 7 pixels wide, 7 pixels tall)
    initializeEmojis() {
        this.emojis = {
            ':smile:': [
                [0,1,1,1,1,1,0],
                [1,0,0,0,0,0,1],
                [1,0,1,0,1,0,1],
                [1,0,0,0,0,0,1],
                [1,0,1,0,1,0,1],
                [1,0,0,1,0,0,1],
                [0,1,1,1,1,1,0]
            ],
            ':heart:': [
                [0,1,1,0,1,1,0],
                [1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1],
                [0,1,1,1,1,1,0],
                [0,0,1,1,1,0,0],
                [0,0,0,1,0,0,0],
                [0,0,0,0,0,0,0]
            ],
            ':star:': [
                [0,0,0,1,0,0,0],
                [0,0,1,1,1,0,0],
                [0,1,1,1,1,1,0],
                [1,1,1,1,1,1,1],
                [0,1,1,1,1,1,0],
                [0,1,0,1,0,1,0],
                [1,0,0,0,0,0,1]
            ],
            ':car:': [
                [0,0,1,1,1,0,0],
                [0,1,1,1,1,1,0],
                [1,1,0,1,0,1,1],
                [1,1,1,1,1,1,1],
                [0,1,1,1,1,1,0],
                [0,1,0,0,0,1,0],
                [0,1,0,0,0,1,0]
            ],
            ':check:': [
                [0,0,0,0,0,0,1],
                [0,0,0,0,0,1,0],
                [1,0,0,0,1,0,0],
                [0,1,0,1,0,0,0],
                [0,0,1,0,0,0,0],
                [0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0]
            ],
            ':arrow:': [
                [0,0,0,1,0,0,0],
                [0,0,0,1,1,0,0],
                [1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1],
                [0,0,0,1,1,0,0],
                [0,0,0,1,0,0,0]
            ],
            ':phone:': [
                [0,0,1,1,1,0,0],
                [0,1,0,0,0,1,0],
                [0,1,0,0,0,1,0],
                [0,1,0,0,0,1,0],
                [0,1,0,0,0,1,0],
                [0,1,0,0,0,1,0],
                [0,0,1,1,1,0,0]
            ],
            ':clock:': [
                [0,1,1,1,1,1,0],
                [1,0,0,0,0,0,1],
                [1,0,0,1,0,0,1],
                [1,0,0,1,1,0,1],
                [1,0,0,0,0,0,1],
                [1,0,0,0,0,0,1],
                [0,1,1,1,1,1,0]
            ],
            ':sun:': [
                [1,0,0,1,0,0,1],
                [0,1,0,1,0,1,0],
                [0,0,1,1,1,0,0],
                [1,1,1,1,1,1,1],
                [0,0,1,1,1,0,0],
                [0,1,0,1,0,1,0],
                [1,0,0,1,0,0,1]
            ],
            ':moon:': [
                [0,0,1,1,1,0,0],
                [0,1,1,0,0,0,0],
                [1,1,0,0,0,0,0],
                [1,1,0,0,0,0,0],
                [1,1,0,0,0,0,0],
                [0,1,1,0,0,0,0],
                [0,0,1,1,1,0,0]
            ],
            ':fire:': [
                [0,0,0,1,0,0,0],
                [0,0,1,1,1,0,0],
                [0,0,1,0,1,0,0],
                [0,1,1,1,1,1,0],
                [0,1,1,1,1,1,0],
                [0,1,1,1,1,1,0],
                [0,0,1,1,1,0,0]
            ],
            ':thumb:': [
                [0,0,1,1,0,0,0],
                [0,0,1,1,0,0,0],
                [0,0,1,1,0,0,0],
                [1,1,1,1,1,1,0],
                [1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1],
                [0,1,1,1,1,1,0]
            ]
        };
    }
    
    // 5x7 Dot Matrix Font (each character is 5 pixels wide, 7 pixels tall)
    initializeFont() {
        this.font = {
            'A': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,1,1,1,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1]
            ],
            'B': [
                [1,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,1,1,1,0]
            ],
            'C': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            'D': [
                [1,1,1,0,0],
                [1,0,0,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,1,0],
                [1,1,1,0,0]
            ],
            'E': [
                [1,1,1,1,1],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,1,1,1,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,1,1,1,1]
            ],
            'F': [
                [1,1,1,1,1],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,1,1,1,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0]
            ],
            'G': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,0],
                [1,0,1,1,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            'H': [
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,1,1,1,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1]
            ],
            'I': [
                [0,1,1,1,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,1,1,1,0]
            ],
            'J': [
                [0,0,1,1,1],
                [0,0,0,1,0],
                [0,0,0,1,0],
                [0,0,0,1,0],
                [1,0,0,1,0],
                [1,0,0,1,0],
                [0,1,1,0,0]
            ],
            'K': [
                [1,0,0,0,1],
                [1,0,0,1,0],
                [1,0,1,0,0],
                [1,1,0,0,0],
                [1,0,1,0,0],
                [1,0,0,1,0],
                [1,0,0,0,1]
            ],
            'L': [
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,1,1,1,1]
            ],
            'M': [
                [1,0,0,0,1],
                [1,1,0,1,1],
                [1,0,1,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1]
            ],
            'N': [
                [1,0,0,0,1],
                [1,1,0,0,1],
                [1,0,1,0,1],
                [1,0,1,0,1],
                [1,0,0,1,1],
                [1,0,0,0,1],
                [1,0,0,0,1]
            ],
            'O': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            'P': [
                [1,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,1,1,1,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,0,0,0,0]
            ],
            'Q': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,1,0,1],
                [1,0,0,1,0],
                [0,1,1,0,1]
            ],
            'R': [
                [1,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,1,1,1,0],
                [1,0,1,0,0],
                [1,0,0,1,0],
                [1,0,0,0,1]
            ],
            'S': [
                [0,1,1,1,1],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [0,1,1,1,0],
                [0,0,0,0,1],
                [0,0,0,0,1],
                [1,1,1,1,0]
            ],
            'T': [
                [1,1,1,1,1],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0]
            ],
            'U': [
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            'V': [
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,0,1,0],
                [0,0,1,0,0]
            ],
            'W': [
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [1,0,1,0,1],
                [1,0,1,0,1],
                [1,1,0,1,1],
                [1,0,0,0,1]
            ],
            'X': [
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,0,1,0],
                [0,0,1,0,0],
                [0,1,0,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1]
            ],
            'Y': [
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,0,1,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0]
            ],
            'Z': [
                [1,1,1,1,1],
                [0,0,0,0,1],
                [0,0,0,1,0],
                [0,0,1,0,0],
                [0,1,0,0,0],
                [1,0,0,0,0],
                [1,1,1,1,1]
            ],
            '0': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,1,1],
                [1,0,1,0,1],
                [1,1,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            '1': [
                [0,0,1,0,0],
                [0,1,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,1,1,1,0]
            ],
            '2': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [0,0,0,0,1],
                [0,0,0,1,0],
                [0,0,1,0,0],
                [0,1,0,0,0],
                [1,1,1,1,1]
            ],
            '3': [
                [1,1,1,1,0],
                [0,0,0,0,1],
                [0,0,0,0,1],
                [0,1,1,1,0],
                [0,0,0,0,1],
                [0,0,0,0,1],
                [1,1,1,1,0]
            ],
            '4': [
                [0,0,0,1,0],
                [0,0,1,1,0],
                [0,1,0,1,0],
                [1,0,0,1,0],
                [1,1,1,1,1],
                [0,0,0,1,0],
                [0,0,0,1,0]
            ],
            '5': [
                [1,1,1,1,1],
                [1,0,0,0,0],
                [1,1,1,1,0],
                [0,0,0,0,1],
                [0,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            '6': [
                [0,1,1,1,0],
                [1,0,0,0,0],
                [1,0,0,0,0],
                [1,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            '7': [
                [1,1,1,1,1],
                [0,0,0,0,1],
                [0,0,0,1,0],
                [0,0,1,0,0],
                [0,1,0,0,0],
                [0,1,0,0,0],
                [0,1,0,0,0]
            ],
            '8': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,0]
            ],
            '9': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1],
                [0,1,1,1,1],
                [0,0,0,0,1],
                [0,0,0,0,1],
                [0,1,1,1,0]
            ],
            ' ': [
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0]
            ],
            '!': [
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,0,0,0],
                [0,0,1,0,0]
            ],
            '-': [
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [1,1,1,1,1],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0]
            ],
            '?': [
                [0,1,1,1,0],
                [1,0,0,0,1],
                [0,0,0,0,1],
                [0,0,0,1,0],
                [0,0,1,0,0],
                [0,0,0,0,0],
                [0,0,1,0,0]
            ],
            '.': [
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,0,0,0,0],
                [0,1,1,0,0],
                [0,1,1,0,0]
            ],
            ':': [
                [0,0,0,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,0,0,0],
                [0,0,1,0,0],
                [0,0,1,0,0],
                [0,0,0,0,0]
            ],
            '🚗': [  // Car emoji as pixel art
                [0,0,1,1,0],
                [1,1,1,1,1],
                [1,0,1,0,1],
                [1,1,1,1,1],
                [0,1,0,1,0],
                [1,0,0,0,1],
                [1,0,0,0,1]
            ],
            '🟢': [  // Green circle
                [0,1,1,1,0],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [0,1,1,1,0]
            ],
            '🔴': [  // Red circle
                [0,1,1,1,0],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [0,1,1,1,0]
            ],
            '⭐': [  // Star
                [0,0,1,0,0],
                [0,0,1,0,0],
                [1,1,1,1,1],
                [0,1,1,1,0],
                [0,1,0,1,0],
                [1,0,0,0,1],
                [0,0,0,0,0]
            ],
            '📞': [  // Phone
                [0,0,0,1,1],
                [0,0,1,0,0],
                [0,1,0,0,0],
                [0,1,0,0,0],
                [0,1,0,0,0],
                [1,0,1,1,0],
                [1,1,0,0,0]
            ]
        };
        
        // Add more letters
        const moreLetters = 'NOPQRSTUVWXYZ';
        // Font is complete above!
    }
    
    // Convert message to pixel array (with emoji support!)
    textToPixels(text) {
        const pixels = [];
        let i = 0;
        
        while (i < text.length) {
            // Check for emoji code
            let foundEmoji = false;
            
            if (text[i] === ':') {
                // Look for closing :
                const emojiEnd = text.indexOf(':', i + 1);
                if (emojiEnd !== -1) {
                    const emojiCode = text.substring(i, emojiEnd + 1).toLowerCase(); // Convert to lowercase for lookup
                    const emojiPixels = this.emojis[emojiCode];
                    
                    if (emojiPixels) {
                        // Add emoji pixels (7x7)
                        for (let row = 0; row < this.rows; row++) {
                            if (!pixels[row]) pixels[row] = [];
                            pixels[row] = pixels[row].concat(emojiPixels[row]);
                            pixels[row].push(0); // Space after emoji
                        }
                        
                        foundEmoji = true;
                        i = emojiEnd + 1; // Skip past the emoji code
                        console.log(`✅ Emoji found: ${emojiCode}`);
                    }
                }
            }
            
            // If no emoji found, process as normal character
            if (!foundEmoji) {
                const char = text[i].toUpperCase();
                const charPixels = this.font[char] || this.font[' '];
                
                // Add character pixels (5x7)
                for (let row = 0; row < this.rows; row++) {
                    if (!pixels[row]) pixels[row] = [];
                    const charRow = charPixels[row] || [0,0,0,0,0];
                    pixels[row] = pixels[row].concat(charRow);
                    pixels[row].push(0); // Space between characters
                }
                
                i++;
            }
        }
        
        return pixels;
    }
    
    // Get rainbow color for position
    getRainbowColor(position, totalPixels) {
        const hue = (position / totalPixels) * 360;
        return this.hslToRgb(hue, 100, 50);
    }
    
    // HSL to RGB conversion
    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r, g, b;
        
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }
    
    // Draw a single LED pixel
    drawLED(x, y, color, brightness = 1.0) {
        const centerX = x * this.pixelWidth + this.ledSize / 2;
        const centerY = y * this.pixelWidth + this.ledSize / 2;
        
        // LED glow (outer)
        const gradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, this.ledSize * 1.5
        );
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${brightness})`);
        gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${brightness * 0.3})`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
            x * this.pixelWidth - this.ledSize / 2,
            y * this.pixelWidth - this.ledSize / 2,
            this.ledSize * 3,
            this.ledSize * 3
        );
        
        // LED core (bright center)
        this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${brightness})`;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.ledSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // LED highlight (makes it look 3D)
        this.ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
        this.ctx.beginPath();
        this.ctx.arc(centerX - this.ledSize / 4, centerY - this.ledSize / 4, this.ledSize / 4, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    // Render the display (direction-aware)
    render() {
        // Clear canvas with current background color
        this.ctx.fillStyle = this.currentBgColor || '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.messagePixels || this.messagePixels.length === 0) return;
        
        const totalPixels = this.messagePixels[0].length;
        
        // STATIC MODE: Show message once, centered
        if (this.scrollDirection === 'static') {
            const startCol = Math.floor((this.cols - totalPixels) / 2);
            
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < totalPixels && (col + startCol) < this.cols; col++) {
                    const displayCol = col + startCol;
                    
                    if (displayCol >= 0 && displayCol < this.cols) {
                        if (this.messagePixels[row] && this.messagePixels[row][col]) {
                            let color;
                            
                            if (this.colorMode === 'rainbow') {
                                // Rainbow: colors move with text
                                color = this.getRainbowColor(col + (Date.now() / 50), totalPixels);
                            } else if (this.colorMode === 'gradient') {
                                // Gradient: colors fixed by display position
                                color = this.getRainbowColor(displayCol, this.cols);
                            } else {
                                // Solid: use base color
                                color = this.baseColor;
                            }
                            
                            this.drawLED(displayCol, row, color, this.brightness);
                        }
                    }
                }
            }
            return;
        }
        
        // SCROLLING MODE: Show message ONCE, entering character-by-character
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                let messageCol;
                
                // Calculate which character of the message should appear at this column
                if (this.scrollDirection === 'right') {
                    // Scroll RIGHT: Message enters from LEFT, exits RIGHT
                    // When scrollPosition=0, we want first char off-screen at position -1
                    // When scrollPosition=totalPixels, first char should be at position 0 (entering)
                    // When scrollPosition=totalPixels+cols, first char at position cols (exiting)
                    // firstCharPosition = scrollPosition - totalPixels
                    // For a given col, messageCol = col - firstCharPosition
                    messageCol = Math.floor(col - (this.scrollPosition - totalPixels));
                } else {
                    // Scroll LEFT: Message enters from RIGHT, exits LEFT  
                    // When scrollPosition=0, first char at position cols (off-screen right)
                    // When scrollPosition increases, first char moves left
                    // firstCharPosition = cols - scrollPosition
                    messageCol = Math.floor(col - (this.cols - this.scrollPosition));
                }
                
                // Only show if this character is within the message bounds
                if (messageCol >= 0 && messageCol < totalPixels) {
                    if (this.messagePixels[row] && this.messagePixels[row][messageCol]) {
                        let color;
                        
                        if (this.colorMode === 'rainbow') {
                            // Rainbow: colors move with text
                            color = this.getRainbowColor(messageCol + (Date.now() / 50), totalPixels);
                        } else if (this.colorMode === 'gradient') {
                            // Gradient: colors fixed by display position
                            color = this.getRainbowColor(col, this.cols);
                        } else {
                            // Solid: use base color
                            color = this.baseColor;
                        }
                        
                        this.drawLED(col, row, color, this.brightness);
                    }
                }
            }
        }
    }
    
    // Set message with direction support
    setMessage(text, scrollMode = 'horizontal', colorMode = 'solid', direction = 'left', textColor = '#00FF00', bgColor = '#000000') {
        console.log('═══════════════════════════════════════');
        console.log('🎨 LED Matrix setMessage() CALLED');
        console.log('   text:', text);
        console.log('   text.length:', text.length, 'characters');
        console.log('   direction:', direction);
        console.log('   textColor:', textColor);
        console.log('   bgColor:', bgColor);
        console.log('═══════════════════════════════════════');
        
        // Store colors
        this.currentTextColor = textColor;
        this.currentBgColor = bgColor;
        
        // Convert hex color to RGB for LED rendering
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 255, b: 0 };
        };
        
        this.baseColor = hexToRgb(textColor);
        
        this.currentMessage = text;
        this.colorMode = colorMode;
        this.scrollDirection = direction; // Store the actual direction
        this.messagePixels = this.textToPixels(text);
        
        const totalPixels = this.messagePixels[0]?.length || 0;
        console.log('   Converted to pixels:', totalPixels, 'pixels wide');
        console.log('   Full cycle distance:', this.cols + totalPixels, 'pixels');
        
        this.scrollPosition = 0;
        this.loopCount = 0;
        this.isPaused = false;
        
        // Stop any existing animation
        this.stopScrolling();
        
        // Map direction to animation (DIRECTION is the key control)
        console.log('🎯 Direction routing decision for:', direction);
        
        if (direction === 'static') {
            // Static display - no movement
            console.log('   → Static display');
            this.render();
        } else if (direction === 'right') {
            // Scroll RIGHT (reverse marquee)
            console.log('   → Starting RIGHT scroll');
            this.startScrollingRight();
        } else if (direction === 'up') {
            // Scroll UP (vertical)
            console.log('   → Starting UP scroll');
            this.startScrollingUp();
        } else if (direction === 'down') {
            // Scroll DOWN (vertical)
            console.log('   → Starting DOWN scroll');
            this.startScrollingDown();
        } else {
            // Default: Scroll LEFT (classic marquee)
            console.log('   → Starting LEFT scroll (default)');
            this.startScrollingLeft();
        }
    }
    
    // Set scroll speed (0.1 = very slow, 1 = medium, 2 = fast)
    setSpeed(speed) {
        this.scrollSpeed = speed;
        console.log('🏃 LED speed set to:', speed);
    }
    
    // Set pause duration between loops
    setPauseDuration(milliseconds) {
        this.pauseDuration = milliseconds;
        console.log('⏸️ LED pause duration set to:', milliseconds, 'ms');
    }
    
    // Scroll Left (Classic horizontal scroll)
    startScrollingLeft() {
        this.isScrolling = true;
        this.scrollDirection = 'left';
        this.isPaused = false;
        
        // START OFF-SCREEN TO THE RIGHT
        this.scrollPosition = 0;
        
        const animate = () => {
            if (!this.isScrolling) return;
            
            if (this.isPaused) {
                this.animationFrame = requestAnimationFrame(animate);
                return;
            }
            
            this.scrollPosition += this.scrollSpeed;
            
            const totalPixels = this.messagePixels[0]?.length || 0;
            // Message must scroll completely OFF the left side
            // Total distance = cols (to enter) + totalPixels (message width to cross and exit)
            const fullCycle = this.cols + totalPixels;
            
            // Log only at key milestones (not every frame)
            if (Math.floor(this.scrollPosition) % 50 === 0) {
                console.log(`Scrolling LEFT - Position: ${this.scrollPosition.toFixed(0)} / ${fullCycle} (${((this.scrollPosition/fullCycle)*100).toFixed(0)}% complete)`);
            }
            
            if (this.scrollPosition >= fullCycle) {
                this.isPaused = true;
                this.loopCount++;
                
                // Background color pause
                this.ctx.fillStyle = this.currentBgColor || '#000000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                console.log(`📺 Scroll LEFT loop ${this.loopCount} complete at position ${this.scrollPosition.toFixed(0)}/${fullCycle} - PAUSE ${this.pauseDuration}ms`);
                
                setTimeout(() => {
                    this.scrollPosition = 0;
                    this.isPaused = false;
                    
                    // If playing sequence, advance to next message
                    if (this.isPlayingSequence && this.messageSequence.length > 1) {
                        this.stopScrolling();
                        this.playNextInSequence();
                    }
                }, this.pauseDuration);
            } else {
                this.render();
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Scroll Right (Reverse) - MIRROR of LEFT scroll
    startScrollingRight() {
        this.isScrolling = true;
        this.scrollDirection = 'right';
        this.isPaused = false;
        
        // Same as LEFT scroll - start at 0
        this.scrollPosition = 0;
        
        const animate = () => {
            if (!this.isScrolling) return;
            
            if (this.isPaused) {
                this.animationFrame = requestAnimationFrame(animate);
                return;
            }
            
            this.scrollPosition += this.scrollSpeed;
            
            const totalPixels = this.messagePixels[0]?.length || 0;
            // Same as LEFT scroll - message must travel full distance
            const fullCycle = totalPixels + this.cols;
            
            if (this.scrollPosition >= fullCycle) {
                this.isPaused = true;
                this.loopCount++;
                
                // Background color pause
                this.ctx.fillStyle = this.currentBgColor || '#000000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                console.log(`📺 Scroll RIGHT loop ${this.loopCount} complete - PAUSE ${this.pauseDuration}ms`);
                
                setTimeout(() => {
                    this.scrollPosition = 0;
                    this.isPaused = false;
                    
                    // If playing sequence, advance to next message
                    if (this.isPlayingSequence && this.messageSequence.length > 1) {
                        this.stopScrolling();
                        this.playNextInSequence();
                    }
                }, this.pauseDuration);
            } else {
                this.render();
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Scroll Up (Vertical)
    startScrollingUp() {
        this.isScrolling = true;
        this.scrollDirection = 'up';
        let yOffset = this.rows;
        this.isPaused = false;
        
        const animate = () => {
            if (!this.isScrolling) return;
            
            if (this.isPaused) {
                this.animationFrame = requestAnimationFrame(animate);
                return;
            }
            
            this.ctx.fillStyle = this.currentBgColor || '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Render message with vertical offset
            yOffset -= this.scrollSpeed * 0.1;
            
            // Render message pixels with vertical scrolling (CENTERED horizontally)
            const totalPixels = this.messagePixels[0]?.length || 0;
            const startCol = Math.floor((this.cols - totalPixels) / 2); // Center horizontally
            
            for (let row = 0; row < this.rows; row++) {
                const displayRow = Math.floor(row + yOffset);
                if (displayRow >= 0 && displayRow < this.rows) {
                    for (let col = 0; col < totalPixels; col++) {
                        const displayCol = col + startCol;
                        if (displayCol >= 0 && displayCol < this.cols) {
                            if (this.messagePixels[row] && this.messagePixels[row][col]) {
                                let color;
                                if (this.colorMode === 'rainbow') {
                                    // Rainbow: colors move with text
                                    color = this.getRainbowColor(col, totalPixels);
                                } else if (this.colorMode === 'gradient') {
                                    // Gradient: colors fixed by display position
                                    color = this.getRainbowColor(displayCol, this.cols);
                                } else {
                                    // Solid: use base color
                                    color = this.baseColor;
                                }
                                this.drawLED(displayCol, displayRow, color, this.brightness);
                            }
                        }
                    }
                }
            }
            
            if (yOffset < -this.rows) {
                this.isPaused = true;
                this.ctx.fillStyle = this.currentBgColor || '#000000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                console.log(`📺 Scroll UP complete - PAUSE ${this.pauseDuration}ms`);
                setTimeout(() => {
                    yOffset = this.rows;
                    this.isPaused = false;
                    
                    // If playing sequence, advance to next message
                    if (this.isPlayingSequence && this.messageSequence.length > 1) {
                        this.stopScrolling();
                        this.playNextInSequence();
                    }
                }, this.pauseDuration);
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Scroll Down (Vertical reverse)
    startScrollingDown() {
        this.isScrolling = true;
        this.scrollDirection = 'down';
        let yOffset = -this.rows;
        this.isPaused = false;
        
        const animate = () => {
            if (!this.isScrolling) return;
            
            if (this.isPaused) {
                this.animationFrame = requestAnimationFrame(animate);
                return;
            }
            
            this.ctx.fillStyle = this.currentBgColor || '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            yOffset += this.scrollSpeed * 0.1;
            
            // Render message pixels with vertical scrolling (CENTERED horizontally)
            const totalPixels = this.messagePixels[0]?.length || 0;
            const startCol = Math.floor((this.cols - totalPixels) / 2); // Center horizontally
            
            for (let row = 0; row < this.rows; row++) {
                const displayRow = Math.floor(row + yOffset);
                if (displayRow >= 0 && displayRow < this.rows) {
                    for (let col = 0; col < totalPixels; col++) {
                        const displayCol = col + startCol;
                        if (displayCol >= 0 && displayCol < this.cols) {
                            if (this.messagePixels[row] && this.messagePixels[row][col]) {
                                let color;
                                if (this.colorMode === 'rainbow') {
                                    // Rainbow: colors move with text
                                    color = this.getRainbowColor(col, totalPixels);
                                } else if (this.colorMode === 'gradient') {
                                    // Gradient: colors fixed by display position
                                    color = this.getRainbowColor(displayCol, this.cols);
                                } else {
                                    // Solid: use base color
                                    color = this.baseColor;
                                }
                                this.drawLED(displayCol, displayRow, color, this.brightness);
                            }
                        }
                    }
                }
            }
            
            if (yOffset > this.rows) {
                this.isPaused = true;
                this.ctx.fillStyle = this.currentBgColor || '#000000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                console.log(`📺 Scroll DOWN complete - PAUSE ${this.pauseDuration}ms`);
                setTimeout(() => {
                    yOffset = -this.rows;
                    this.isPaused = false;
                    
                    // If playing sequence, advance to next message
                    if (this.isPlayingSequence && this.messageSequence.length > 1) {
                        this.stopScrolling();
                        this.playNextInSequence();
                    }
                }, this.pauseDuration);
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Bounce animation
    startBounce() {
        this.isScrolling = true;
        let bounceOffset = 0;
        let bounceDirection = 1;
        
        const animate = () => {
            if (!this.isScrolling) return;
            
            this.ctx.fillStyle = this.currentBgColor || '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            bounceOffset += bounceDirection * this.scrollSpeed * 0.5;
            
            if (Math.abs(bounceOffset) > 10) {
                bounceDirection *= -1;
            }
            
            this.render();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Fade animation
    startFade() {
        this.isScrolling = true;
        let fadeValue = 0;
        let fadeDirection = 0.02;
        
        const animate = () => {
            if (!this.isScrolling) return;
            
            fadeValue += fadeDirection * this.scrollSpeed;
            
            if (fadeValue >= 1 || fadeValue <= 0) {
                fadeDirection *= -1;
                fadeValue = Math.max(0, Math.min(1, fadeValue));
            }
            
            this.brightness = fadeValue;
            this.render();
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Legacy startScrolling (maps to left)
    startScrolling() {
        this.startScrollingLeft();
    }
    
    // Stop scrolling
    stopScrolling() {
        this.isScrolling = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
    
    // Set color (for solid color mode)
    setColor(r, g, b) {
        this.baseColor = { r, g, b };
        this.colorMode = 'solid';
        this.render();
    }
    
    // Set to rainbow mode
    setRainbowMode() {
        this.colorMode = 'rainbow';
        this.render();
    }
}

// Initialize when DOM is ready
let ledMatrix;

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('ledMatrixCanvas');
    if (canvas) {
        ledMatrix = new LEDMatrix('ledMatrixCanvas', {
            ledSize: 4,      // Size of each LED dot
            ledSpacing: 1.5, // Space between LEDs
            rows: 7,         // 7 pixels tall
            cols: 80         // 80 pixels wide
        });
        
        // Set initial message
        ledMatrix.setMessage('CHECKING STATUS...', 'horizontal', 'rainbow');
        
        // Make globally accessible
        window.ledMatrix = ledMatrix;
        
        console.log('🎨 LED Matrix initialized! Use ledMatrix.setMessage() to change text');
    }
});

// ADMIN ONLY: Remove global access for customers
// Customers cannot program LED sign from console
// Only admins can control via admin dashboard

console.log('🎨 LED Matrix loaded! Pixel-based LED sign ready.');
console.log('ℹ️  LED sign controlled by admin dashboard only.');

