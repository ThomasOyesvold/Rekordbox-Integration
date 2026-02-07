import { motion } from 'framer-motion';
import './Card.css';

export function Card({ children, className = '', hoverable = false, ...props }) {
  return (
    <motion.div
      className={`card ${hoverable ? 'card-hoverable' : ''} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={hoverable ? { y: -2, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' } : {}}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }) {
  return <div className={`card-content ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`}>{children}</div>;
}
