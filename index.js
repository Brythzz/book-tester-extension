const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.scale(2, 2);

const concat = args => {
    return Array.prototype.concat(...args);
}

const importCrowdinString = merge => {
    browser.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs[0]?.url.includes('crowdin.com')) return;

        browser.tabs.sendMessage(tabs[0].id, null, response => {
            if (response) {
                const bookString = response.replace(varRegex, (match, token) => {
                    const code = Object.keys(formattingCodes).find(key => formattingCodes[key][0] === token);
                    return code
                        ? '\u00A7' + code
                        : match;
                });

                const input = document.querySelector('textarea');

                const lineJump = input.value ? '\n' : '';
                const newString = merge
                    ? input.value + lineJump + bookString
                    : bookString;

                input.value = newString;
                saveString(newString);
                drawText(newString);
            }
        });
    });
}

const saveString = string => {
    browser.storage.local.set({ text: string || null });
}

const getUnicodeCharData = charCode => {
    const [start, end] = unicodeChars[charCode];

    const startX = charCode % 16 * 16 + start;
    const startY = Math.floor(charCode / 16) * 16 % 256;

    const width = (end + 1 - start) / 2;
    const pageId = Math.floor(charCode / 256);

    return { startX, startY, width, pageId };
}

const initCanvas = async () => {
    await new Promise(resolve => {
        const image = new Image(146, 180);
        image.onload = () => {
            ctx.drawImage(image, 0, 0);
            resolve();
        }
        image.src = 'book.png';
    });
}

const drawAsciiChar = (charCode, x, y, t) => {
    const charCanvas = document.createElement('canvas');
    charCanvas.width = canvas.width;
    charCanvas.height = canvas.height;

    let { w, d } = asciiChars[charCode];
    const charData = concat(d);

    const imageData = new ImageData(new Uint8ClampedArray(charData), w);
    charCtx = charCanvas.getContext('2d');

    charCtx.putImageData(imageData, 0, 0);

    if (stylingRules.bold) {
        charCtx.globalCompositeOperation = 'source-in';
        charCtx.fillStyle = stylingRules.color;
        charCtx.fillRect(0, 0, w + 2, 8);

        ctx.drawImage(charCanvas, x, y + t);
        charCtx.putImageData(imageData, 1, 0);
    }

    charCtx.globalCompositeOperation = 'source-in';
    charCtx.fillStyle = stylingRules.color;
    charCtx.fillRect(0, 0, w + 2, 8);

    ctx.drawImage(charCanvas, x, y + t);

    drawFormatting(x, y, w + 1 + stylingRules.bold);
}

const drawUnicodeChar = ({ startX, startY, width, pageId }, x, y) => {
    const charCanvas = document.createElement('canvas');
    charCanvas.width = 18;
    charCanvas.height = 16;

    charCtx = charCanvas.getContext('2d');
    charCtx.imageSmoothingEnabled = false;
    charCtx.scale(2, 2);

    const glyphImage = images[pageId];
    charCtx.drawImage(glyphImage, startX, startY, width * 2, 16, 0, 0, width, 8);

    charCtx.globalCompositeOperation = 'source-in';
    charCtx.fillStyle = stylingRules.color;
    charCtx.fillRect(0, 0, width + 2, 16);

    ctx.drawImage(charCanvas, 0, 0, width * 2, 16, x, y, width, 8);
    if (stylingRules.bold)
        ctx.drawImage(charCanvas, 0, 0, width * 2, 16, x + 1, y, width, 8);

    drawFormatting(x, y, width + (width * 2 % 2 === 0 ? 1 : .5) + stylingRules.bold);
}

const marginLeft = 16;
const marginTop = 31;

const varRegex = /%%([^%]{3,13})%%/g;

const formattingCodes = {
    '0' : ['black', '#000'],
    '1' : ['dark_blue', '#00A'],
    '2' : ['dark_green', '#0A0'],
    '3' : ['dark_aqua', '#0AA'],
    '4' : ['dark_red', '#A00'],
    '5' : ['rark_purple', '#A0A'],
    '6' : ['gold', '#FA0'],
    '7' : ['gray', '#AAA'],
    '8' : ['dark_gray', '#555'],
    '9' : ['blue', '#55F'],
    'a' : ['green', '#5F5'],
    'b' : ['aqua', '#5FF'],
    'c' : ['red', '#F55'],
    'd' : ['light_purple', '#F5F'],
    'e' : ['yellow', '#FF5'],
    'f' : ['white', '#FFF'],

    'l': ['bold'],
    'm': ['strikethrough'],
    'n': ['underline'],
    'o': ['italic'],
    'r': ['reset']
};

const defaultStyle = {
    bold: false,
    strikethrough: false,
    underline: false,
    italic: false,
    color: '#000'
}

let stylingRules;

const resetStyle = () => stylingRules = {...defaultStyle};

const drawText = async text => {
    await initCanvas();
    let currentY = marginTop;

    const lines = text.split('\n');
    for (let k in lines) {
        const line = lines[k];
        resetStyle();

        let currentX = marginLeft;
        const words = line.split(' ');

        for (let i in words) {
            const word = words[i];
            const spaceWidth = stylingRules.bold ? 5 : 4;
            let wordWidth = getWordWidth(word);

            const isLongWord = wordWidth > 106;

            const isOverflowing = (!isLongWord && currentX + wordWidth + spaceWidth > 126)
                || (isLongWord && words.length > 1 && i > 0);
    
            if (isOverflowing) {
                currentX = marginLeft - spaceWidth;
                resetStyle();
                currentY += 9;
            }

            if (i > 0) {
                drawFormatting(currentX, currentY, spaceWidth);
                currentX += spaceWidth;
            }

            const [newY, newX] = drawWord(word, currentX, currentY);

            currentY = newY;
            currentX = newX;

            if (currentY > 151) return;
        }

        currentX = marginLeft;
        currentY += 9;
    }
}

const applyStyle = char => {
    if (!char) return;
    const modifier = char.toLowerCase();

    if (modifier in formattingCodes) {
        const [style, color] = formattingCodes[modifier];
        if (color) {
            resetStyle();
            stylingRules.color = color;
        }
        else
            stylingRules[style] = true;
    }
}

const applyStyles = chars => chars.map(applyStyle);

const drawWord = (word, x, y) => {
    let currentX = x;

    if (y > 151) {
        return [y, currentX];
    }

    let tempStyles = [];

    for (let i = 0; i < word.length; i++) {
        const charCode = word[i].charCodeAt();

        if (charCode === 167) {
            tempStyles.push(word[i + 1]);
            i++;
            continue;
        }

        const asciiChar = asciiChars[charCode];
        applyStyles(tempStyles);

        if (asciiChar) {
            let { w, t } = asciiChar;
            if (stylingRules.bold) w++;

            if (currentX + w > 131) {
                resetStyle();
                applyStyles(tempStyles);
                return drawWord(word.substring(i), marginLeft, y + 9);
            }

            drawAsciiChar(charCode, currentX, y, t);
            currentX += w + 1;
        }
        else {
            const charData = getUnicodeCharData(charCode);
            if (!charData) continue;
            
            if (currentX + charData.width + stylingRules.bold > 131) {
                resetStyle();
                applyStyles(tempStyles);
                return drawWord(word.substring(i), marginLeft, y + 9);
            }

            drawUnicodeChar(charData, currentX, y);
            const width = charData.width;

            currentX += width + (width * 2 % 2 === 0 ? 1 : .5) + stylingRules.bold;
        }
        tempStyles = [];
    }

    return [y, currentX];
}

const drawFormatting = (x, y, width) => {
    ctx.fillStyle = stylingRules.color;

    if (stylingRules.strikethrough)
        ctx.fillRect(x, y + 3, width, 1);

    if (stylingRules.underline)
        ctx.fillRect(x - 1, y + 8, width + 1, 1);
}

const getWordWidth = word => {
    let length = 0;

    for (let c = 0; c < word.length; c++) {
        const charCode = word[c].charCodeAt();
        if (charCode > 65536) continue;

        if (charCode === 167) {
            c++;
            continue;
        }
        
        const asciiChar = asciiChars[charCode];

        length += asciiChar
            ? asciiChar.w + 1
            : getUnicodeCharData(charCode).width + 1;
    }

    if (stylingRules.bold) length += word.length; // +1px for each char

    return length;
}

const fetchGlyphs = async () => {
    const path = browser.runtime.getURL('font/glyph_sizes.bin');
    const res = await fetch(path);
    return await res.arrayBuffer();
}

const loadGlyphs = async () => {
    const buf = await fetchGlyphs();
    const bytes = new Int8Array(buf);
    for (let i in bytes) {
        const byte = bytes[i];
        unicodeChars[i] = [byte >>> 4, byte & 15];
    }
}

const noPage = n => (n == 8) || (n >= 216 && n <= 248);

const loadImages = async () => {
    for (let i = 0; i < 256; i++) {
        if (noPage(i)) continue;

        let pageId = (i).toString(16);
        if (pageId.length < 2) pageId = '0' + pageId;

        const image = new Image(256, 256);
        image.src = browser.runtime.getURL(`font/unicode_page_${pageId}.png`);
        images[i] = image;
    }
}

const copySectionSign = () => {
    navigator.clipboard.writeText('\u00A7');
}

const initButtons = async () => {
    const buttons = document.querySelectorAll('button');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });

    const isOnCrowdin = tabs[0]?.url.includes('crowdin.com');

    if (isOnCrowdin) {
        buttons[0].addEventListener('click', () => importCrowdinString(false));
        buttons[1].addEventListener('click', () => importCrowdinString(true));
    }
    else {
        buttons[0].disabled = true;
        buttons[1].disabled = true;
    }

    buttons[2].addEventListener('click', copySectionSign);
}

const initTextArea = async input => {
    input.addEventListener('input', () => {
        saveString(input.value);
        drawText(input.value);
    });
}

const unicodeChars = Array(65536);
const images = Array(256);

const loadText = async input => {
    const { text } = await browser.storage.local.get(['text']);
    const translation = text || '';
    input.value = translation;
}

(async () => {
    const input = document.querySelector('textarea');
    initButtons();

    await Promise.all(
        [loadGlyphs(), loadImages(), loadText(input)]
    )

    initTextArea(input);
    drawText(input.value);
})();
