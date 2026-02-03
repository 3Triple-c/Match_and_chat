import { useState } from "react";
import { useGroupStore } from "../../stores/groupStore";

export default function CreateGroup() {
  const [name, setName] = useState("");
  const createGroup = useGroupStore(s => s.createGroup);

  const submit = e => {
    e.preventDefault();
    createGroup({ name });
    setName("");
  };

  return(
   <form onSubmit={submit}>
    <input value={name}
    onChange={e => setName(e.target.value)}
    placeholder="Group Name" />
    <button>Create</button>
   </form>
  )
}
