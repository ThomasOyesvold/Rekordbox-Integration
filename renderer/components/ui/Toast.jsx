import { motion } from 'framer-motion';
import { CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import './Toast.css';

const iconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info
};

export function Toast({ message, variant = 'info', onClose }) {
  const Icon = iconMap[variant] || Info;

  return (
    <motion.div
      className={`toast toast-${variant}`}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2 }}
    >
      <Icon size={18} />
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={() => onClose?.()}>
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ children }) {
  return <div className="toast-container">{children}</div>;
}
