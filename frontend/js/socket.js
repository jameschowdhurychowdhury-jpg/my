const SocketClient = {
  socket: null,

  init(username, callbacks) {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Force websocket transport first to eliminate 5-second polling delay
    this.socket = io({
      query: { user: username },
      transports: ["websocket", "polling"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 500,
      timeout: 10000
    });

    this.socket.on("receive_encrypted_message", (data) => callbacks.onMessageReceived?.(data));
    this.socket.on("user_status", (data) => callbacks.onStatusChanged?.(data));
    this.socket.on("user_typing", (data) => callbacks.onTypingChanged?.(data));
    this.socket.on("message_deleted", (data) => callbacks.onMessageDeleted?.(data));
    this.socket.on("message_edited", (data) => callbacks.onMessageEdited?.(data));
    this.socket.on("message_highlighted", (data) => callbacks.onMessageHighlighted?.(data));
    this.socket.on("view_once_consumed", (data) => callbacks.onViewOnceConsumed?.(data));
  },

  sendMessage(payload) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("send_encrypted_message", payload);
    }
  },

  editMessage(id, text) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("edit_message", { id, text });
    }
  },

  toggleHighlight(id, isHighlighted) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("highlight_message", { id, is_highlighted: isHighlighted });
    }
  },

  deleteMessage(id) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("delete_message", { id });
    }
  },

  notifyViewOnceOpened(id) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("view_once_opened", { id });
    }
  },

  sendTyping(isTyping) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("typing", { isTyping });
    }
  }
};