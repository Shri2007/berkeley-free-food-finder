import { useEffect, useRef } from 'react'
import type { FoodEvent } from './api'
import { PostForm } from './PostForm'

interface Props {
  onClose: () => void
  onPosted: (event: FoodEvent) => void
}

/** Phone-sized screens: the post form in a bottom sheet. Wide screens use the side panel instead. */
export function PostSheet({ onClose, onPosted }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Native <dialog> gives us focus trapping, Esc, and a backdrop for free.
  // No cleanup on purpose: calling close() here would fire the `close` event,
  // which unmounts the sheet. StrictMode's double effect run would do that instantly.
  // Unmounting removes the element from the DOM, which closes it silently.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-label="Post free food"
      onClose={onClose}
      onClick={(e) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet__inner">
        <div className="sheet__bar">
          <h2 className="panel__title">Post free food</h2>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet__body">
          <PostForm onPosted={onPosted} onCancel={onClose} />
        </div>
      </div>
    </dialog>
  )
}
