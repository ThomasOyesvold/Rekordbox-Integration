import { motion } from 'framer-motion';
import './Button.css';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  onClick,
  disabled = false,
  className = '',
  ...props
}) {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <motion.button
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      <span className="btn-text">{children}</span>
    </motion.button>
  );
}

export function IconButton({ icon, onClick, className = '', ...props }) {
  return (
    <motion.button
      className={`icon-button ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      {icon}
    </motion.button>
  );
}
