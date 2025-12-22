'use client';

import { motion, Variants } from 'motion/react';

interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { dot: 12, gap: 6, jump: -18 },
  md: { dot: 20, gap: 10, jump: -30 },
  lg: { dot: 28, gap: 14, jump: -42 },
};

export default function LoadingDots({ size = 'md', className = '' }: LoadingDotsProps) {
  const { dot, gap, jump } = sizeMap[size];

  const dotVariants: Variants = {
    jump: {
      y: jump,
      transition: {
        duration: 0.8,
        repeat: Infinity,
        repeatType: 'mirror',
        ease: 'easeInOut',
      },
    },
  };

  return (
    <motion.div
      animate="jump"
      transition={{ staggerChildren: -0.2, staggerDirection: -1 }}
      className={`flex justify-center items-center ${className}`}
      style={{ gap }}
    >
      <motion.div
        className="rounded-full bg-primary will-change-transform"
        style={{ width: dot, height: dot }}
        variants={dotVariants}
      />
      <motion.div
        className="rounded-full bg-primary will-change-transform"
        style={{ width: dot, height: dot }}
        variants={dotVariants}
      />
      <motion.div
        className="rounded-full bg-primary will-change-transform"
        style={{ width: dot, height: dot }}
        variants={dotVariants}
      />
    </motion.div>
  );
}
