interface ToastProps {
  message: string
  type: 'success' | 'error'
  action?: { label: string; onClick: () => void }
}

export default function Toast({ message, type, action }: ToastProps) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white text-sm border transition-all animate-in flex items-center gap-3 max-w-sm ${
        type === 'success'
          ? 'bg-green-800 border-green-600'
          : 'bg-red-800 border-red-600'
      }`}
    >
      <span className="shrink-0">{type === 'success' ? '✅' : '❌'}</span>
      <span className="font-medium">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 ml-1 underline font-semibold hover:no-underline whitespace-nowrap"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
