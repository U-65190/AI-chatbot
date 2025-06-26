from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from fastapi.responses import JSONResponse
import base64
from uuid import uuid4
from typing import Dict, List

# Setup Gemini

genai.configure(api_key="AIzaSyBh4TA-HjyxpQy0AJ-0EHDEcQ0EScwOFa8")
model = genai.GenerativeModel("gemini-1.5-flash")

app = FastAPI()

# Pydantic model for chat messages
class ChatMessage(BaseModel):
    message: str


# In-memory session storage
chat_sessions: Dict[str, List[dict]] = {}  # session_id -> list of messages

# Helper to create a gyst (summary) for a chat session
def make_gyst(history):
    for msg in history:
        if msg["role"] == "user":
            return msg["parts"][0][:40] + ("..." if len(msg["parts"][0]) > 40 else "")
    return "No messages"

@app.post("/chat/{session_id}")
async def chat(session_id: str, chat_message: ChatMessage):
    # Create session if not exists
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    history = chat_sessions[session_id]

    # Add user message
    history.append({"role": "user", "parts": [chat_message.message]})

    # Include memory from image descriptions (optional, per session)
    memory_context = "\n".join([f"Image '{img['filename']}': {img['description']}" for img in image_memory])
    if memory_context:
        history.append({"role": "user", "parts": [f"Previously uploaded images:\n{memory_context}"]})

    # Generate response
    response = model.generate_content(history)
    history.append({"role": "model", "parts": [response.text]})

    return JSONResponse(content={"reply": response.text})

@app.get("/chat-sessions")
async def get_chat_sessions():
    # Return a list of session ids and their gyst
    return {"sessions": [
        {"id": sid, "gyst": make_gyst(history)}
        for sid, history in chat_sessions.items()
    ]}

@app.get("/chat-session/{session_id}")
async def get_chat_session(session_id: str):
    history = chat_sessions.get(session_id, [])
    # Return only user/model messages
    return {"history": [
        {"role": msg["role"], "text": msg["parts"][0]}
        for msg in history if msg["role"] in ["user", "model"]
    ]}

@app.post("/new-session")
async def new_session():
    session_id = str(uuid4())
    chat_sessions[session_id] = []
    return {"session_id": session_id}



# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Memory for chat and images
chat_history = []
image_memory = []  # Each item: {"filename": ..., "description": ...}

# Chat endpoint with memory
@app.post("/chat")
async def chat(chat_message: ChatMessage):
    # Add user message
    chat_history.append({"role": "user", "parts": [chat_message.message]})

    # Include memory from image descriptions
    memory_context = "\n".join([f"Image '{img['filename']}': {img['description']}" for img in image_memory])
    if memory_context:
        chat_history.append({"role": "user", "parts": [f"Previously uploaded images:\n{memory_context}"]})

    # Generate response
    response = model.generate_content(chat_history)

    # Save model's response
    chat_history.append({"role": "model", "parts": [response.text]})

    return JSONResponse(content={"reply": response.text})


# Image analysis endpoint with memory
from PIL import Image
import io
from google.generativeai.types import content_types

@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        response = model.generate_content([
            {"mime_type": file.content_type, "data": b64_image},
            {"text": "Describe what's in this image."}
        ])

        # Store to memory
        image_memory.append({
            "filename": file.filename,
            "description": response.text
        })

        return JSONResponse(content={"reply": response.text})

    except Exception as e:
        print("Error in /analyze-image:", str(e))
        return JSONResponse(content={"error": str(e)}, status_code=500)
    
