interface ToastProps {
  message: string
  type: 'success' | 'error'
}

export default function Toast({ message, type }: ToastProps) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white font-medium text-sm border transition-all animate-in ${
        type === 'success'
          ? 'bg-green-800 border-green-600'
          : 'bg-red-800 border-red-600'
      }`}
    >
      <span className="mr-2">{type === 'success' ? '✅' : '❌'}</span>
      {message}
    </div>
  )
}
