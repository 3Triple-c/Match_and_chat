import { useEffect, useState } from "react";
import useGroupchat from "../../hooks/useGroupChat";
import api from "../../api/axios";

export default function GroupChat({ groupId }) {
  const { messages, setMessages } = useGroupchat(groupId);
  const [text, setText] = useState("");

  const submit = e => {
    e.preventDefault();
    setMessages(text);
    setText("");
  };

  return (
    <div>
      <div>
        {messages.map(m => (
          <p key={m._id}>
            <b>{m.sender}</b>:{m.content}
          </p>
        ))}
      </div>

      <form onSubmit={submit}>
        <input
          value="text"
          onChange={e => setText(e.target.value)}
          placeholder="type..."
        />
        <button>Send</button>
      </form>
    </div>
  );

  useEffect(() => {
    if (!groupId) return;

    api.get(`/messages/${groupId}`).then(res => {
      setMessages(res.data);
    });
  }, [groupId]);
}
