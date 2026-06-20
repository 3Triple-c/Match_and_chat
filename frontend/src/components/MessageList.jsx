export default function MessageList({ messages }) {
  if (!messages?.length) {
    return <p className="muted">No messages yet.</p>;
  }
  return (
    <div className="message-list">
      {messages.map(m => (
        <div key={m._id} className="message">
          <div className="message-meta">{m.sender?.email || m.sender}</div>
          <div className="message-body">{m.content}</div>
          <div className="message-time">
            {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
