"""
Nova AI - Flask backend
Designed and developed by Rahul Dharuman
"""

import json

import ollama
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

app = Flask(__name__)

DEFAULT_MODEL = "mistral:latest"
MAX_CONTEXT_MESSAGES = 30
SYSTEM_PROMPT = (
    "You are Nova, a helpful, friendly and concise AI assistant. "
    "Answer clearly. Use Markdown for formatting and fenced code blocks for code."
)


def clean_messages(raw):
    """Validate the conversation sent by the browser and keep the most recent turns."""
    messages = []
    if not isinstance(raw, list):
        return messages
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})
    return messages[-MAX_CONTEXT_MESSAGES:]


def installed_models():
    try:
        result = ollama.list()
        items = result.get("models", []) if isinstance(result, dict) else getattr(result, "models", [])
        names = []
        for m in items:
            name = getattr(m, "model", None)
            if name is None and isinstance(m, dict):
                name = m.get("model") or m.get("name")
            if name:
                names.append(name)
        return names
    except Exception as e:  # Ollama not running, etc.
        print("Could not list models:", e)
        return []


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/models")
def models():
    names = installed_models()
    if DEFAULT_MODEL not in names and not names:
        names = [DEFAULT_MODEL]
    default = DEFAULT_MODEL if DEFAULT_MODEL in names else names[0]
    return jsonify({"models": names, "default": default})


@app.route("/api/chat", methods=["POST"])
def chat():
    """Non-streaming endpoint (kept as a simple fallback)."""
    try:
        data = request.get_json(silent=True) or {}
        messages = clean_messages(data.get("messages"))
        if not messages and data.get("message", "").strip():
            messages = [{"role": "user", "content": data["message"].strip()}]
        if not messages:
            return jsonify({"error": "Message cannot be empty"}), 400

        response = ollama.chat(
            #model=data.get("model") or DEFAULT_MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        )
        return jsonify({"reply": response["message"]["content"]})
    except Exception as e:
        print("Ollama error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    data = request.get_json(silent=True) or {}
    messages = clean_messages(data.get("messages"))
    if not messages:
        return jsonify({"error": "Message cannot be empty"}), 400
    model = data.get("model") or DEFAULT_MODEL

    def generate():
        try:
            stream = ollama.chat(
                model=model,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                stream=True,
            )
            for chunk in stream:
                token = chunk["message"]["content"]
                if token:
                    yield json.dumps({"token": token}) + "\n"
            yield json.dumps({"done": True}) + "\n"
        except Exception as e:
            print("Ollama error:", e)
            yield json.dumps({"error": str(e)}) + "\n"

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
