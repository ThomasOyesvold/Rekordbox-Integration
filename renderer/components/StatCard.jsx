import { motion } from 'framer-motion';
import './StatCard.css';

export function StatCard({ icon: Icon, value, label, trend }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
      transition={{ duration: 0.2 }}
    >
      <div className="stat-icon">{Icon ? <Icon size={24} /> : null}</div>
      <div className="stat-content">
        <div className="stat-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="stat-label">{label}</div>
        {typeof trend === 'number' ? (
          <div className={`stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
