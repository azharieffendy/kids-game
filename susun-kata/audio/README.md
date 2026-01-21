# 🎵 Audio Files for Indonesian Words

## 📁 File Structure
Place your MP3 files in this directory with the following naming convention:

```
audio/
├── AIR.mp3          (for word "AIR")
├── GUNUNG.mp3       (for word "GUNUNG") 
├── LAUT.mp3         (for word "LAUT")
├── ES KRIM.mp3      (for word "ES KRIM" - note the space)
└── ... (one file per word)
```

## 🎯 Naming Rules
- File name must match the EXACT word from questions.json
- Use ALL CAPS letters
- Replace spaces with actual spaces (not underscores)
- Use .mp3 extension

## 📝 Example
If questions.json contains:
```json
{"word": "AYAM", "emoji": "🐔", "hint": "Hewan yang berkokok"}
```

Then create: `AYAM.mp3`

## ⚠️ Important Notes
- Not all words need audio files
- Missing files will automatically use text-to-speech
- Keep files small for fast loading (under 100KB recommended)
- Use clear, child-friendly pronunciation

## 🔄 Fallback System
1. Try to load MP3 file first
2. If file not found, use Indonesian text-to-speech
3. Works seamlessly without interrupting gameplay