import Modal from './Modal'
import { InstallSteps } from '../pages/InstallPage'

/** Install from inside the app (Get started, the Home note): the same steps as the install screen. */
export default function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Install the app" onClose={onClose}>
      <div className="sheet-body login-like">
        <p className="list-foot" style={{ marginTop: 0 }}>
          It opens full screen, works without signal and keeps your data on this phone.
        </p>
        <InstallSteps />
      </div>
    </Modal>
  )
}
