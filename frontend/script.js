let currentSessionId = null;

window.onload = async function() {
    await startNewSession();
};

async function startNewSession() {
    const res = await fetch("http://localhost:8000/new-session", { method: "POST" }); // Adjust the URL if needed (your FastAPI backend URL)
    if (res.ok) {
        const data = await res.json();
        currentSessionId = data.session_id;
    }
}

async function appendMessage(role, text) {
    const chatBox = document.getElementById("chat-box");
    const message = document.createElement("div");
    message.className = role;
    message.innerText = text;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function toggleChatDropdown() {
    const dropdown = document.getElementById("chatDropdown");
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    if (dropdown.style.display === "block") {
        fetchChatSessions();
    }
}

async function fetchChatSessions() {
    // Replace with your backend endpoint for chat sessions
    const res = await fetch("http://localhost:8000/chat-sessions");
    if (res.ok) {
        const data = await res.json();
        const chatSelect = document.getElementById("chatSelect");
        chatSelect.innerHTML = '<option value="">Select a chat...</option>';
        data.sessions.forEach(session => {
            // session.gyst is a short summary, session.id is the session identifier
            const option = document.createElement("option");
            option.value = session.id;
            option.text = session.gyst;
            chatSelect.appendChild(option);
        });
    }
}

async function loadSelectedChat() {
    const chatSelect = document.getElementById("chatSelect");
    const sessionId = chatSelect.value;
    if (!sessionId) return;
    currentSessionId = sessionId; // <-- update current session
    const res = await fetch(`http://localhost:8000/chat-session/${sessionId}`);
    if (res.ok) {
        const data = await res.json();
        const chatBox = document.getElementById("chat-box");
        chatBox.innerHTML = "";
        data.history.forEach(msg => {
            appendMessage(msg.role === "model" ? "bot" : "user", msg.text);
        });
    }
}

async function sendMessage() {
    const messageInput = document.getElementById("message");
    const userMessage = messageInput.value;
    if (!userMessage) return;

    // Display user message in the chat
    appendMessage("user", userMessage);
    messageInput.value = ""; // Clear input after sending message

    // Send the message to your FastAPI backend
    const res = await fetch(`http://localhost:8000/chat/${currentSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }), // Sending a message object
    });

    if (res.ok) {
        const data = await res.json();
        appendMessage("bot", data.reply); // Show the AI-generated response
    } else {
        const errorData = await res.json();
        appendMessage("bot", "Error: " + errorData.detail); // Show any errors that come from the backend
    }
}

async function uploadImage() {
    const fileInput = document.getElementById("imageInput");
    if (!fileInput.files.length) return;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    // Send the image file to your FastAPI backend for analysis
    const res = await fetch("http://localhost:8000/analyze-image", {
        method: "POST",
        body: formData,
    });

    const data = await res.json();
    appendMessage("bot", "Image Result: " + data.reply); // Show the image analysis result
}

function updateFileName() {
    const fileInput = document.getElementById("imageInput");
    const fileName = fileInput.files.length ? fileInput.files[0].name : "";
    document.getElementById("fileLabel").innerText = fileName || "Choose File";
}
function updateFileName() {
    const fileInput = document.getElementById("imageInput");
    const fileLabel = document.getElementById("fileLabel");
    const previewImage = document.getElementById("previewImage");
    const imageLink = document.getElementById("imageLink");

    if (fileInput.files.length) {
        const file = fileInput.files[0];
        fileLabel.innerText = file.name;

        // Show image preview
        const imageURL = URL.createObjectURL(file);
        previewImage.src = imageURL;
        previewImage.style.display = "block";

        // Make it clickable to open in a new tab
        imageLink.href = imageURL;
    } else {
        fileLabel.innerText = "Choose File";
        previewImage.style.display = "none";
        imageLink.removeAttribute("href");
    }
}