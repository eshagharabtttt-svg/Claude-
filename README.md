# Claude Environment Setup

یک پروژه برای کار با Claude API

## نیازمندی‌ها (Requirements)

- Python 3.8+
- pip

## راه‌اندازی (Setup)

### 1. Clone Repository
```bash
git clone https://github.com/eshagharabtttt-svg/Claude-
cd Claude-
```

### 2. Virtual Environment بسازید
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Dependencies نصب کنید
```bash
pip install -r requirements.txt
```

### 4. .env فایل بسازید
```bash
# .env.example رو کپی کنید
cp .env.example .env

# سپس .env رو باز کنید و Claude API Key خودتون رو اضافه کنید
```

### 5. اجرا کنید
```bash
python main.py
```

## ساختار پروژه
```
Claude-/
├── .env.example       # Environment variables template
├── .gitignore        # Git ignore file
├── requirements.txt  # Python dependencies
├── README.md        # این فایل
└── main.py          # Main application file
```

## استفاده (Usage)

اپلیکیشن تون رو در `main.py` بنویسید:

```python
import os
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

client = Anthropic()

def chat_with_claude():
    """Claude رو مثل یک chatbot استفاده کن"""
    conversation_history = []
    
    print("Claude چت‌بات (چهار برای خروج 'exit' بنویسید)")
    
    while True:
        user_input = input("\nشما: ").strip()
        
        if user_input.lower() == 'exit':
            break
        
        if not user_input:
            continue
        
        conversation_history.append({
            "role": "user",
            "content": user_input
        })
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system="تو یک دستیار مفید و دوستانه‌ای.",
            messages=conversation_history
        )
        
        assistant_message = response.content[0].text
        conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })
        
        print(f"\nClaude: {assistant_message}")

if __name__ == "__main__":
    chat_with_claude()
```

## مسائل (Troubleshooting)

### API Key نیست؟
- از [Anthropic Console](https://console.anthropic.com) API Key خودت رو دریافت کن
- اونو `.env` فایلت میریز

### Import Error؟
- Virtual environment فعال شده؟ چک کن!
- `pip install -r requirements.txt` دوباره اجرا کن

## مراجع (References)

- [Anthropic API Docs](https://docs.anthropic.com)
- [Python dotenv](https://github.com/theskumar/python-dotenv)

---

**Happy Coding! 🚀**
