document.addEventListener("DOMContentLoaded", () => {
  const authModal = document.getElementById("auth-modal");
  const authBtn = document.getElementById("auth-submit-btn");
  const usernameSelect = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");

  const settingsModal = document.getElementById("settings-modal");
  const settingsBtn = document.getElementById("settings-btn");
  const mobileSettingsBtn = document.getElementById("mobile-settings-btn");
  const closeSettingsBtn = document.getElementById("close-settings-btn");
  const b2UsedMb = document.getElementById("b2-used-mb");
  const b2ProgressBar = document.getElementById("b2-progress-bar");
  const b2PctText = document.getElementById("b2-pct-text");

  const adminPassInput = document.getElementById("admin-pass");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminVaultContainer = document.getElementById("admin-vault-container");
  const adminMediaList = document.getElementById("admin-media-list");

  const mediaViewerModal = document.getElementById("media-viewer-modal");
  const closeViewerBtn = document.getElementById("close-viewer-btn");
  const mediaViewerContent = document.getElementById("media-viewer-content");

  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  const messagesContainer = document.getElementById("chat-messages");
  const dragOverlay = document.getElementById("drag-drop-overlay");

  const pendingChip = document.getElementById("pending-attachment-chip");
  const pendingThumb = document.getElementById("pending-thumb");
  const pendingFilename = document.getElementById("pending-filename");
  const clearPendingBtn = document.getElementById("clear-pending-btn");

  const replyPreviewBar = document.getElementById("reply-preview-bar");
  const replyPreviewUser = document.getElementById("reply-preview-user");
  const replyPreviewSnippet = document.getElementById("reply-preview-snippet");
  const cancelReplyBtn = document.getElementById("cancel-reply-btn");

  const partnerAvatar = document.getElementById("partner-avatar");
  const partnerName = document.getElementById("partner-name");
  const partnerStatusDot = document.getElementById("partner-status-dot");
  const headerStatusText = document.getElementById("header-status-text");
  const typingIndicator = document.getElementById("typing-indicator");
  const typingText = document.getElementById("typing-text");

  const plusMenuBtn = document.getElementById("plus-menu-btn");
  const mediaPopup = document.getElementById("media-popup");
  const filePhoto = document.getElementById("file-photo");
  const fileVideo = document.getElementById("file-video");
  const fileAudio = document.getElementById("file-audio");
  const onetimeToggleBtn = document.getElementById("onetime-toggle-btn");

  const soundSend = document.getElementById("sound-send");
  const soundReceive = document.getElementById("sound-receive");

  let currentUser = "";
  let partnerUser = "";
  let typingTimeout = null;
  let isViewOnceActive = false;
  let stagedFile = null;
  let stagedType = null;
  let currentAdminPassword = "";
  let currentReplyTo = null; // { id, text, sender }

  const formatTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const playChime = (audioEl) => {
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
    }
  };

  onetimeToggleBtn.addEventListener("click", () => {
    isViewOnceActive = !isViewOnceActive;
    onetimeToggleBtn.classList.toggle("active", isViewOnceActive);
  });

  plusMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mediaPopup.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!mediaPopup.contains(e.target) && e.target !== plusMenuBtn) {
      mediaPopup.classList.add("hidden");
    }
  });

  mediaPopup.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      mediaPopup.classList.add("hidden");
      const type = btn.getAttribute("data-type");
      if (type === "photo") filePhoto.click();
      if (type === "video") fileVideo.click();
      if (type === "audio") fileAudio.click();
    });
  });

  const stageFile = (file, forcedType = null) => {
    let msgType = forcedType;
    if (!msgType) {
      if (file.type.startsWith("image/")) msgType = "photo";
      else if (file.type.startsWith("video/")) msgType = "video";
      else if (file.type.startsWith("audio/")) msgType = "audio";
      else msgType = "photo";
    }

    stagedFile = file;
    stagedType = msgType;

    pendingFilename.textContent = file.name;
    if (msgType === "photo") {
      pendingThumb.src = URL.createObjectURL(file);
      pendingThumb.classList.remove("hidden");
    } else {
      pendingThumb.classList.add("hidden");
    }

    pendingChip.classList.remove("hidden");
    messageInput.placeholder = "Add a caption or send...";
    messageInput.focus();
  };

  const clearStagedFile = () => {
    stagedFile = null;
    stagedType = null;
    pendingChip.classList.add("hidden");
    pendingThumb.src = "";
    filePhoto.value = "";
    fileVideo.value = "";
    fileAudio.value = "";
    messageInput.placeholder = "Type your message or drag & drop items...";
  };

  clearPendingBtn.addEventListener("click", (e) => {
    e.preventDefault();
    clearStagedFile();
  });

  filePhoto.addEventListener("change", (e) => { if (e.target.files[0]) stageFile(e.target.files[0], "photo"); });
  fileVideo.addEventListener("change", (e) => { if (e.target.files[0]) stageFile(e.target.files[0], "video"); });
  fileAudio.addEventListener("change", (e) => { if (e.target.files[0]) stageFile(e.target.files[0], "audio"); });

  ["dragenter", "dragover"].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      dragOverlay.classList.remove("hidden");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      if (e.target === dragOverlay || eventName === "drop") {
        dragOverlay.classList.add("hidden");
      }
    });
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragOverlay.classList.add("hidden");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      stageFile(e.dataTransfer.files[0]);
    }
  });

  const openMediaModal = (url, type) => {
    mediaViewerContent.innerHTML = "";
    if (type === "photo") {
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "90vw";
      img.style.maxHeight = "85vh";
      mediaViewerContent.appendChild(img);
    } else if (type === "video") {
      const vid = document.createElement("video");
      vid.src = url;
      vid.controls = true;
      vid.autoplay = true;
      vid.style.maxWidth = "90vw";
      vid.style.maxHeight = "85vh";
      mediaViewerContent.appendChild(vid);
    }
    mediaViewerModal.style.display = "flex";
  };

  closeViewerBtn.onclick = () => {
    mediaViewerContent.innerHTML = "";
    mediaViewerModal.style.display = "none";
  };

  const startReply = (msgId, text, sender) => {
    currentReplyTo = { id: msgId, text: text || "Media Attachment", sender };
    replyPreviewUser.textContent = `Replying to ${sender}`;
    replyPreviewSnippet.textContent = currentReplyTo.text;
    replyPreviewBar.classList.remove("hidden");
    messageInput.focus();
  };

  cancelReplyBtn.onclick = () => {
    currentReplyTo = null;
    replyPreviewBar.classList.add("hidden");
  };

  const appendMessage = (data) => {
    const {
      id,
      text,
      sender,
      timestamp = formatTime(),
      msg_type = "text",
      media_url = "",
      is_view_once = false,
      viewed = false,
      is_highlighted = false,
      reply_to_text = "",
      is_edited = false
    } = data;

    if (document.getElementById(`msg-${id}`)) return;

    const isMe = sender === currentUser;
    const bubble = document.createElement("div");
    bubble.id = `msg-${id}`;
    bubble.className = `message-bubble ${isMe ? "me" : "partner"} ${is_highlighted ? "highlighted" : ""}`;

    // Floating Action Toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "bubble-toolbar";

    // Reply Button
    const replyBtn = document.createElement("button");
    replyBtn.className = "tb-btn";
    replyBtn.title = "Reply";
    replyBtn.textContent = "↩️";
    replyBtn.onclick = () => startReply(id, text, sender);
    toolbar.appendChild(replyBtn);

    // Edit Button (Only for own text messages)
    if (isMe && msg_type === "text") {
      const editBtn = document.createElement("button");
      editBtn.className = "tb-btn";
      editBtn.title = "Edit message";
      editBtn.textContent = "✏️";
      editBtn.onclick = () => {
        const textSpan = bubble.querySelector(".bubble-text");
        const currentMsg = textSpan ? textSpan.textContent : text;
        const newMsg = prompt("Edit your message:", currentMsg);
        if (newMsg !== null && newMsg.trim() !== "" && newMsg.trim() !== currentMsg) {
          SocketClient.editMessage(id, newMsg.trim());
        }
      };
      toolbar.appendChild(editBtn);
    }

    // Highlight / Star Button
    const starBtn = document.createElement("button");
    starBtn.className = "tb-btn";
    starBtn.title = "Highlight / Star";
    starBtn.textContent = is_highlighted ? "⭐" : "☆";
    starBtn.onclick = () => {
      const newState = !bubble.classList.contains("highlighted");
      SocketClient.toggleHighlight(id, newState);
    };
    toolbar.appendChild(starBtn);

    // Delete Button
    const delBtn = document.createElement("button");
    delBtn.className = "tb-btn";
    delBtn.title = "Delete for both";
    delBtn.textContent = "🗑️";
    delBtn.onclick = () => {
      if (confirm("Delete this message permanently?")) {
        SocketClient.deleteMessage(id);
      }
    };
    toolbar.appendChild(delBtn);

    bubble.appendChild(toolbar);

    // Quoted Reply Preview Inside Bubble
    if (reply_to_text) {
      const quoted = document.createElement("div");
      quoted.className = "quoted-box";
      quoted.textContent = `↪ ${reply_to_text}`;
      bubble.appendChild(quoted);
    }

    const contentBox = document.createElement("div");

    if (is_view_once) {
      const pill = document.createElement("div");
      pill.id = `view-once-${id}`;
      pill.className = `view-once-pill ${viewed ? "consumed" : ""}`;
      pill.innerHTML = `<span>①</span> <span>${viewed ? "Opened" : (msg_type.toUpperCase() + " • Click to view")}</span>`;

      if (!viewed) {
        pill.onclick = () => {
          openMediaModal(media_url, msg_type);
          pill.classList.add("consumed");
          pill.innerHTML = `<span>①</span> <span>Opened</span>`;
          pill.onclick = null;
          SocketClient.notifyViewOnceOpened(id);
        };
      }
      contentBox.appendChild(pill);
      if (text) {
        const cap = document.createElement("span");
        cap.className = "bubble-caption";
        cap.textContent = text;
        contentBox.appendChild(cap);
      }
    } else {
      if (msg_type === "photo") {
        const img = document.createElement("img");
        img.src = media_url;
        img.className = "chat-image";
        img.onclick = () => openMediaModal(media_url, "photo");
        contentBox.appendChild(img);
      } else if (msg_type === "video") {
        const vid = document.createElement("video");
        vid.src = media_url;
        vid.controls = true;
        vid.className = "chat-video";
        contentBox.appendChild(vid);
      } else if (msg_type === "audio") {
        const aud = document.createElement("audio");
        aud.src = media_url;
        aud.controls = true;
        aud.className = "chat-audio";
        contentBox.appendChild(aud);
      }

      if (text) {
        const textSpan = document.createElement("span");
        textSpan.className = msg_type !== "text" ? "bubble-caption" : "bubble-text";
        textSpan.textContent = text;
        contentBox.appendChild(textSpan);
      }
    }

    bubble.appendChild(contentBox);

    const metaDiv = document.createElement("div");
    metaDiv.className = "message-meta";

    if (is_edited) {
      const editedTag = document.createElement("span");
      editedTag.className = "edited-tag";
      editedTag.textContent = "(edited)";
      metaDiv.appendChild(editedTag);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "bubble-time";
    timeSpan.textContent = timestamp;
    metaDiv.appendChild(timeSpan);

    if (isMe) {
      const checkSpan = document.createElement("span");
      checkSpan.textContent = "✓✓";
      metaDiv.appendChild(checkSpan);
    }

    bubble.appendChild(metaDiv);
    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const loadMessageHistory = async () => {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) return;
      const messages = await res.json();

      for (const msg of messages) {
        const displayBody = msg.msg_type === "text" ? (msg.text || "") : (msg.caption || "");
        appendMessage({
          id: msg.id,
          text: displayBody,
          sender: msg.sender,
          timestamp: msg.timestamp,
          msg_type: msg.msg_type,
          media_url: msg.media_url,
          is_view_once: msg.is_view_once,
          viewed: msg.viewed,
          is_highlighted: msg.is_highlighted,
          reply_to_text: msg.reply_to_text,
          is_edited: msg.is_edited
        });
      }
    } catch (err) {
      console.error("Failed to load message history:", err);
    }
  };

  const updateStorageMeter = async () => {
    try {
      const res = await fetch("/api/storage-info");
      const data = await res.json();
      b2UsedMb.textContent = `${data.used_mb} MB`;
      b2ProgressBar.style.width = `${Math.min(data.used_pct, 100)}%`;
      b2PctText.textContent = `${data.used_pct}% of 10 GB free tier used`;
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Vault Modal Handler
  adminLoginBtn.addEventListener("click", async () => {
    const password = adminPassInput.value.trim();
    if (!password) {
      alert("Please enter the admin password.");
      return;
    }

    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Access Denied");
        return;
      }

      currentAdminPassword = password;
      adminMediaList.innerHTML = "";

      if (!data.vault || data.vault.length === 0) {
        adminMediaList.innerHTML = `<div style="grid-column: 1/-1; font-size: 0.8rem; color: #888; padding: 0.5rem;">No view-once media in vault yet.</div>`;
      } else {
        data.vault.forEach((item) => {
          const card = document.createElement("div");
          card.className = "vault-card";
          card.id = `vault-card-${item.id}`;

          let mediaEl = "";
          if (item.msg_type === "photo") {
            mediaEl = `<img src="${item.media_url}" alt="Vault Image" />`;
          } else if (item.msg_type === "video") {
            mediaEl = `<video src="${item.media_url}"></video>`;
          } else {
            mediaEl = `<div style="color:white;font-size:1.5rem;">🎵</div>`;
          }

          card.innerHTML = `
            ${mediaEl}
            <button type="button" class="vault-delete-btn" title="Delete permanently">🗑️</button>
          `;

          card.querySelector(".vault-delete-btn").onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Permanently delete this one-time media from storage?")) {
              try {
                const delRes = await fetch("/api/admin/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password: currentAdminPassword, id: item.id })
                });
                if (delRes.ok) {
                  card.remove();
                } else {
                  alert("Delete failed.");
                }
              } catch (err) {
                alert("Network error deleting item.");
              }
            }
          };

          card.onclick = () => openMediaModal(item.media_url, item.msg_type);
          adminMediaList.appendChild(card);
        });
      }

      adminVaultContainer.style.display = "block";
      adminPassInput.value = "";
    } catch (err) {
      alert("Admin connection failed: " + err.message);
    }
  });

  const openSettings = () => {
    settingsModal.style.display = "flex";
    updateStorageMeter();
  };
  if (settingsBtn) settingsBtn.onclick = openSettings;
  if (mobileSettingsBtn) mobileSettingsBtn.onclick = openSettings;
  if (closeSettingsBtn) closeSettingsBtn.onclick = () => (settingsModal.style.display = "none");

  const performLogin = (username) => {
    currentUser = username;
    partnerUser = currentUser === "Ame" ? "G...F💕" : "Ame";

    partnerName.textContent = partnerUser;
    partnerAvatar.src = currentUser === "Ame" ? "assets/stickers/bunny.svg" : "assets/stickers/dragon.svg";

    SocketClient.init(currentUser, {
      onMessageReceived: (payload) => {
        const textToShow = payload.msg_type === "text" ? (payload.text || "") : (payload.caption || "");
        appendMessage({
          id: payload.id,
          text: textToShow,
          sender: payload.sender,
          timestamp: payload.timestamp || formatTime(),
          msg_type: payload.msg_type,
          media_url: payload.media_url,
          is_view_once: payload.is_view_once,
          viewed: false,
          is_highlighted: false,
          reply_to_text: payload.reply_to_text || "",
          is_edited: false
        });
        playChime(soundReceive);
      },
      onStatusChanged: (data) => {
        const isPartnerOnline = data.online_users && data.online_users.includes(partnerUser);
        partnerStatusDot.className = `status-indicator ${isPartnerOnline ? "online" : "offline"}`;
        headerStatusText.textContent = isPartnerOnline ? "online" : "offline";
      },
      onTypingChanged: (data) => {
        if (data.isTyping && data.user === partnerUser) {
          typingText.textContent = `${partnerUser} is typing...`;
          typingIndicator.classList.remove("hidden");
        } else {
          typingIndicator.classList.add("hidden");
        }
      },
      onMessageDeleted: (data) => {
        const el = document.getElementById(`msg-${data.id}`);
        if (el) el.remove();
        const vaultEl = document.getElementById(`vault-card-${data.id}`);
        if (vaultEl) vaultEl.remove();
      },
      onMessageEdited: (data) => {
        const el = document.getElementById(`msg-${data.id}`);
        if (el) {
          const textSpan = el.querySelector(".bubble-text");
          if (textSpan) textSpan.textContent = data.text;
          const meta = el.querySelector(".message-meta");
          if (meta && !meta.querySelector(".edited-tag")) {
            const tag = document.createElement("span");
            tag.className = "edited-tag";
            tag.textContent = "(edited)";
            meta.prepend(tag);
          }
        }
      },
      onMessageHighlighted: (data) => {
        const el = document.getElementById(`msg-${data.id}`);
        if (el) {
          el.classList.toggle("highlighted", data.is_highlighted);
          const starBtn = el.querySelector(".bubble-toolbar button[title*='Highlight']");
          if (starBtn) starBtn.textContent = data.is_highlighted ? "⭐" : "☆";
        }
      },
      onViewOnceConsumed: (data) => {
        const pill = document.getElementById(`view-once-${data.id}`);
        if (pill) {
          pill.classList.add("consumed");
          pill.innerHTML = `<span>①</span> <span>Opened</span>`;
          pill.onclick = null;
        }
      }
    });

    authModal.style.display = "none";
    loadMessageHistory();
  };

  authBtn.addEventListener("click", async () => {
    const username = usernameSelect.value;
    const password = passwordInput.value.trim();

    if (!password) {
      alert("Please enter your password.");
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Login failed");
        return;
      }

      // Use sessionStorage for security
      sessionStorage.setItem("lantern_user", username);
      performLogin(username);
    } catch (err) {
      alert("Error logging in. Make sure backend is running.");
    }
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const typedText = messageInput.value.trim();

    const replyId = currentReplyTo ? currentReplyTo.id : "";
    const replySnippet = currentReplyTo ? currentReplyTo.text : "";

    if (stagedFile) {
      const formData = new FormData();
      formData.append("file", stagedFile);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error("Upload failed");

        const msgId = "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
        const payload = {
          id: msgId,
          sender: currentUser,
          text: "",
          msg_type: stagedType,
          media_url: data.url,
          caption: typedText,
          is_view_once: isViewOnceActive,
          viewed: false,
          reply_to_id: replyId,
          reply_to_text: replySnippet,
          timestamp: formatTime()
        };

        SocketClient.sendMessage(payload);
        appendMessage({
          id: msgId,
          text: typedText,
          sender: currentUser,
          timestamp: payload.timestamp,
          msg_type: stagedType,
          media_url: data.url,
          is_view_once: isViewOnceActive,
          viewed: false,
          is_highlighted: false,
          reply_to_text: replySnippet,
          is_edited: false
        });
        playChime(soundSend);

        clearStagedFile();
        currentReplyTo = null;
        replyPreviewBar.classList.add("hidden");
        messageInput.value = "";
        isViewOnceActive = false;
        onetimeToggleBtn.classList.remove("active");
        SocketClient.sendTyping(false);
      } catch (err) {
        alert("Media send failed: " + err.message);
      }
      return;
    }

    if (!typedText) return;

    const msgId = "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
    const payload = {
      id: msgId,
      sender: currentUser,
      text: typedText,
      timestamp: formatTime(),
      msg_type: "text",
      media_url: "",
      caption: "",
      is_view_once: false,
      reply_to_id: replyId,
      reply_to_text: replySnippet
    };

    SocketClient.sendMessage(payload);
    appendMessage({
      id: msgId,
      text: typedText,
      sender: currentUser,
      timestamp: payload.timestamp,
      msg_type: "text",
      media_url: "",
      is_view_once: false,
      viewed: false,
      is_highlighted: false,
      reply_to_text: replySnippet,
      is_edited: false
    });
    playChime(soundSend);

    currentReplyTo = null;
    replyPreviewBar.classList.add("hidden");
    messageInput.value = "";
    SocketClient.sendTyping(false);
  });

  messageInput.addEventListener("input", () => {
    SocketClient.sendTyping(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      SocketClient.sendTyping(false);
    }, 1500);
  });

  // --- Session Lock & Background Lifecycle Handling ---
  // When reloading or leaving the page, remove the active session token
  window.addEventListener("pagehide", () => {
    sessionStorage.removeItem("lantern_user");
  });

  // If tab stays in memory (e.g. switching tabs / minimizing to background), session persists
  const activeUser = sessionStorage.getItem("lantern_user");
  if (activeUser && (activeUser === "Ame" || activeUser === "G...F💕")) {
    performLogin(activeUser);
  } else {
    // Show login overlay by default
    authModal.style.display = "flex";
  }
});