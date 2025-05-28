
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function BarkrBackflip({ trigger }: { trigger: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1800); // Show for 1.8s
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.img
          src="/images/barkr.png" // Make sure this path is correct
          alt="Barkr doing a flip"
          className="fixed left-1/2 top-1/2 w-32 h-auto z-[9999] pointer-events-none -translate-x-1/2 -translate-y-1/2"
          initial={{ rotate: 0, y: 0, scale: 1, opacity: 0 }}
          animate={{
            rotate: 360,
            y: [-20, -80, -20],
            scale: [1, 1.3, 1],
            opacity: 1,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
      )}
    </AnimatePresence>
  );
}
