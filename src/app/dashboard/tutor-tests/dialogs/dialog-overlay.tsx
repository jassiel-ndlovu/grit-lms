const DialogOverlay = ({ children }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
      {children}
    </div>
  </div>
);

export default DialogOverlay;