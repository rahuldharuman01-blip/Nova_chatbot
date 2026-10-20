# Nova AI

A locally hosted AI chatbot built with **Flask**, **Ollama**, HTML, CSS, and JavaScript. Nova AI provides a browser-based chat interface that connects to an Ollama model running on your computer.

**Designed and developed by Rahul Dharuman**

## Features

- Local AI chat through Ollama — no cloud AI API key is required.
- Streaming responses, displayed as the model generates them.
- Automatically lists locally installed Ollama models in the model selector.
- Chat history saved in the browser's `localStorage`.
- Search, rename, delete, and export conversations.
- Light and dark themes.
- Markdown-style answers and formatted code blocks with copy buttons.
- Responsive layout for desktop and mobile screens.
- Stop response generation when needed.

## Technology stack

- **Python**
- **Flask** — web server and API endpoints
- **Ollama** — runs the local language model
- **Ollama Python library** — communicates with Ollama
- **HTML** — page structure
- **CSS** — styling and responsive layout
- **JavaScript** — chat interface and streaming
- **Browser localStorage** — stores chat history and preferences

## Requirements

- Windows, macOS, or Linux
- Python 3.10 or a compatible version supported by the installed Flask and Ollama packages
- Ollama installed and running
- At least one Ollama model downloaded
- A modern web browser

> Model speed and memory requirements depend on the model you install and your computer's hardware.

## Project structure

Arrange the project files like this so Flask can find the template and static assets:

```text
Nova-AI/
├── app.py
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

If your files currently have names such as `index(2).html`, `style(2).css`, or `script(1).js`, rename them to `index.html`, `style.css`, and `script.js` and place them in the folders shown above.

## Installation and setup

### 1. Install Python

Install Python from [python.org](https://www.python.org/downloads/) if it is not already installed. During Windows installation, enable **Add Python to PATH** if that option is available.

### 2. Install Ollama

Download and install Ollama from [ollama.com](https://ollama.com/).

Open PowerShell or Command Prompt and check that Ollama is available:

```powershell
ollama --version
ollama list
```

### 3. Download a model

The backend's default model is `mistral:latest`. If you want to use that model, run:

```powershell
ollama pull mistral
```

Confirm the installed model name:

```powershell
ollama list
```

If you use another model, select its installed name in the website's model selector. The model selector is populated from Ollama's locally installed models.

### 4. Create and activate a virtual environment

Open a terminal in the project directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, you can run the environment's Python directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install Flask ollama
```

### 5. Install Python dependencies

With the virtual environment activated, run:

```powershell
python -m pip install --upgrade pip
python -m pip install Flask ollama
```

### 6. Start Ollama and the Flask application

Make sure the Ollama application/service is running. Then, from the project directory, start Flask:

```powershell
python app.py
```

The application is configured to run at:

```text
http://127.0.0.1:5000
```

Open that address in your browser.

## Using Nova AI

1. Open `http://127.0.0.1:5000` while the Flask server is running.
2. Choose an installed Ollama model from the model selector.
3. Type a message and press **Enter** to send it. Use **Shift + Enter** for a new line.
4. Start a new conversation using **New chat**.
5. Search previous conversations in the sidebar. Rename or delete a conversation using its controls.
6. Use the menu to export the current chat as a Markdown file or clear chat history.
7. Switch between light and dark themes using the theme button.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Serves the chatbot interface |
| `GET` | `/api/models` | Returns the locally installed model names and default model |
| `POST` | `/api/chat` | Returns a complete response for a message |
| `POST` | `/api/chat/stream` | Streams response chunks as newline-delimited JSON |

### Example streaming request

```json
{
  "model": "mistral:latest",
  "messages": [
    {
      "role": "user",
      "content": "Explain artificial intelligence simply."
    }
  ]
}
```

The streaming endpoint returns newline-delimited JSON events containing response `token` values, a final `done` event, or an `error` event.

## Troubleshooting

### The website says it cannot reach Ollama

- Check that the Ollama application/service is running.
- Run `ollama list` in a terminal.
- Try a simple model prompt from the terminal, replacing the model name if needed:

  ```powershell
  ollama run mistral
  ```

- Restart Ollama and then restart Flask.

### The model selector is empty or shows an unexpected model

- Run `ollama list` and check the exact model name.
- Refresh the browser after Ollama is running.
- Make sure the model is installed locally.

### Flask reports `TemplateNotFound: index.html`

Check that the HTML file is named `index.html` and is inside the `templates` folder next to `app.py`.

### CSS or JavaScript does not load

Check that `style.css` and `script.js` are inside the `static` folder and that the HTML references them using Flask's `url_for('static', filename='...')`.

### The model responds slowly

The first response can take longer while the model loads. Response speed also depends on model size, available RAM/VRAM, and your computer.

## Privacy

Prompts are sent from the browser to the Flask server running on your computer, which forwards them to your local Ollama service. Chat history and theme/model preferences are stored in your browser's `localStorage`. This project does not require a cloud AI API key. Avoid entering sensitive information if other people can access your computer or browser profile.

## Limitations and notes

- Ollama must be running for AI responses to work.
- The configured default model is `mistral:latest`; the model must be installed or changed to a model that is installed.
- The app is configured to bind to `127.0.0.1`, so it is intended for local use on the same computer.
- This README describes the supplied project files; test the setup on your machine before presenting it as a fully working installation.

## License

No license has been specified. Add a license file if you intend to distribute this project publicly.
