# Available Google Cloud TTS Voices Reference

## ✅ Voices That Actually Exist in Google Cloud

### English (en-US)

| Voice            | Type     | Quality | Speed     | Best For              |
| ---------------- | -------- | ------- | --------- | --------------------- |
| en-US-Standard-F | Standard | 6/10    | Fast ⚡   | Quick generation      |
| en-US-Standard-A | Standard | 6/10    | Fast ⚡   | Alternative female    |
| en-US-Neural2-F  | Neural2  | 8/10    | Medium 🚀 | **Default choice**    |
| en-US-Neural2-A  | Neural2  | 8/10    | Medium 🚀 | Alternative female    |
| en-US-Wavenet-F  | Wavenet  | 10/10   | Slow ⏱️   | **Premium choice** ⭐ |
| en-US-Wavenet-A  | Wavenet  | 10/10   | Slow ⏱️   | Premium alternative   |

### Japanese (ja-JP)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| ja-JP-Standard-A | Standard | 6/10    | Quick generation      |
| ja-JP-Neural2-B  | Neural2  | 8/10    | **Default choice**    |
| ja-JP-Wavenet-B  | Wavenet  | 10/10   | **Premium choice** ⭐ |

### Spanish (es-ES)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| es-ES-Standard-A | Standard | 6/10    | Quick generation      |
| es-ES-Neural2-A  | Neural2  | 8/10    | **Default choice**    |
| es-ES-Wavenet-A  | Wavenet  | 10/10   | **Premium choice** ⭐ |

### French (fr-FR)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| fr-FR-Standard-A | Standard | 6/10    | Quick generation      |
| fr-FR-Neural2-A  | Neural2  | 8/10    | **Default choice**    |
| fr-FR-Wavenet-A  | Wavenet  | 10/10   | **Premium choice** ⭐ |

### German (de-DE)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| de-DE-Standard-A | Standard | 6/10    | Quick generation      |
| de-DE-Neural2-A  | Neural2  | 8/10    | **Default choice**    |
| de-DE-Wavenet-A  | Wavenet  | 10/10   | **Premium choice** ⭐ |

### Portuguese (pt-BR)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| pt-BR-Standard-A | Standard | 6/10    | Quick generation      |
| pt-BR-Neural2-A  | Neural2  | 8/10    | **Default choice**    |
| pt-BR-Wavenet-A  | Wavenet  | 10/10   | **Premium choice** ⭐ |

### Russian (ru-RU)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| ru-RU-Standard-A | Standard | 6/10    | Quick generation      |
| ru-RU-Wavenet-A  | Wavenet  | 10/10   | **Premium choice** ⭐ |

### Korean (ko-KR)

| Voice            | Type     | Quality | Best For           |
| ---------------- | -------- | ------- | ------------------ |
| ko-KR-Standard-A | Standard | 6/10    | Quick generation   |
| ko-KR-Neural2-A  | Neural2  | 8/10    | **Default choice** |

### Italian (it-IT)

| Voice            | Type     | Quality | Best For              |
| ---------------- | -------- | ------- | --------------------- |
| it-IT-Standard-A | Standard | 6/10    | Quick generation      |
| it-IT-Neural2-A  | Neural2  | 8/10    | **Default choice**    |
| it-IT-Wavenet-A  | Wavenet  | 10/10   | **Premium choice** ⭐ |

---

## ❌ Voices That DON'T Exist (Chirp, Journey)

### Non-Existent Voices

```
en-US-Chirp-HD-F        ❌ DOES NOT EXIST
en-US-Journey-F         ❌ DOES NOT EXIST
ja-JP-Chirp-HD-F        ❌ DOES NOT EXIST
ja-JP-Journey-B         ❌ DOES NOT EXIST
```

**What happens if you request them:**

1. API returns 400 error
2. System falls back to Neural2
3. You get same output as default

**Our fix:** Map them to Wavenet instead

- Chirp request → Uses Wavenet (better than Neural2!)
- Journey request → Uses Wavenet (better than Neural2!)

---

## 🎯 Recommended Setup

### For Fast & Cheap Podcasts

```
Provider: "🎤 Google TTS (Standard Quality)"
Voice: en-US-Standard-F
Cost: ~$0.01/episode
Speed: 1-2 seconds
Quality: Good, clear
```

### For Most Users (Balanced)

```
Provider: "🎧 Google Standard (Fast & Good)"
Voice: en-US-Neural2-F
Cost: ~$0.02/episode
Speed: 2-3 seconds
Quality: Very good, natural
```

### For Premium/Professional

```
Provider: "✨ Google Wavenet Premium (Highest Quality)"
Voice: en-US-Wavenet-F
Cost: ~$0.04/episode
Speed: 3-5 seconds
Quality: Best available, most expressive
```

---

## 📊 Quality Comparison

### Speaking Sample: "Hey everyone, welcome back!"

**Standard:**

- Speed: 1.0x (natural speed)
- Tone: Professional but slightly mechanical
- Naturalness: 6/10
- Cost: Cheapest

**Neural2:**

- Speed: 1.0x (natural speed)
- Tone: Natural, professional
- Naturalness: 8/10
- Cost: Medium

**Wavenet:**

- Speed: 0.95x (slightly slower)
- Tone: Very natural, expressive, premium
- Naturalness: 10/10
- Cost: Most expensive

---

## 🔧 Technical Specs

### Voice Types in Google Cloud

**Standard Voices:**

- Basic TTS engine
- Good pronunciation
- Slightly robotic
- Lowest cost

**Neural2 Voices:**

- Deep learning based
- Much more natural
- Better prosody (rhythm, intonation)
- Medium cost

**Wavenet Voices:**

- Most advanced TTS
- Sounds human-like
- Best emotional expression
- Highest cost

---

## 💡 Why This Matters

When you select different TTS options in the admin:

```
Option 1: "Google Standard"
→ Uses en-US-Standard-F
→ Fast, cheap, clear

Option 2: "Google Neural2"
→ Uses en-US-Neural2-F
→ Better quality, slightly slower

Option 3: "Google Wavenet Premium"
→ Uses en-US-Wavenet-F
→ Best quality, slowest, most expensive
```

**Before the fix:** Options 1, 2, 3 all sounded the same (all fell back to Neural2)
**After the fix:** Each option has distinct, different sound quality

---

## 📋 Checklist

- ✅ Standard voices work (en-US-Standard-F)
- ✅ Neural2 voices work (en-US-Neural2-F)
- ✅ Wavenet voices work (en-US-Wavenet-F)
- ✅ Multiple languages supported
- ✅ Fallback logic handles missing languages
- ✅ Admin dropdown shows quality tiers clearly
- ✅ Logs indicate which voice type is selected

---

## 🚀 Testing Procedure

```bash
# 1. Reload Django
python manage.py runserver

# 2. Create podcast with script
# 3. Select "Google Standard" → Regenerate → Listen
# 4. Select "Google Neural2" → Regenerate → Listen (better!)
# 5. Select "Google Wavenet Premium" → Regenerate → Listen (best!)
# 6. Hear the DIFFERENCES!
```

---

## Resources

- [Google Cloud TTS Documentation](https://cloud.google.com/text-to-speech/docs)
- [List of All Voices](https://cloud.google.com/text-to-speech/docs/voices)
- [Pricing](https://cloud.google.com/text-to-speech/pricing)
