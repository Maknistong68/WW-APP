// How many forms are open right now. An app update waits while this is above
// zero, so a new version never reloads the page under someone's typing.

let open = 0
const idle = new Set<() => void>()

/** Call when a form opens; call the returned function when it closes. */
export function beginEdit(): () => void {
  open += 1
  let done = false
  return () => {
    if (done) return
    done = true
    open = Math.max(0, open - 1)
    if (open === 0) idle.forEach((f) => f())
  }
}

export const editingCount = () => open

/** Run when the last open form closes (a waiting update can go then). */
export function onEditingIdle(f: () => void): () => void {
  idle.add(f)
  return () => {
    idle.delete(f)
  }
}
