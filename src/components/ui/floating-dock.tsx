import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";

type FloatingDockItem = { title: string; icon: ReactNode; href: string };
type Orientation = "horizontal" | "vertical";

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
  orientation = "horizontal",
}: {
  items: FloatingDockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
  orientation?: Orientation;
}) => {
  return (
    <>
      <FloatingDockDesktop
        items={items}
        className={desktopClassName}
        orientation={orientation}
      />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: FloatingDockItem[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: {
                    delay: idx * 0.05,
                  },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <a
                  href={item.href}
                  key={item.title}
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-400 via-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5 hover:shadow-indigo-400/60"
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </a>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-400 via-indigo-500 to-purple-500 text-slate-900 shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5 hover:shadow-indigo-400/60"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-slate-900" />
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
  orientation = "horizontal",
}: {
  items: FloatingDockItem[];
  className?: string;
  orientation?: Orientation;
}) => {
  const mousePosition = useMotionValue(Infinity);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (orientation === "vertical") {
      mousePosition.set(event.pageY);
      return;
    }
    mousePosition.set(event.pageX);
  };

  const handleMouseLeave = () => {
    mousePosition.set(Infinity);
  };

  const baseClass =
    orientation === "vertical"
      ? "hidden md:flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-4 backdrop-blur"
      : "mx-auto hidden md:flex h-16 items-end gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 pb-3 backdrop-blur";

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(baseClass, className)}
    >
      {items.map((item) => (
        <IconContainer
          mousePosition={mousePosition}
          orientation={orientation}
          key={item.title}
          {...item}
        />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mousePosition,
  title,
  icon,
  href,
  orientation,
}: {
  mousePosition: MotionValue;
  title: string;
  icon: ReactNode;
  href: string;
  orientation: Orientation;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mousePosition, (val) => {
    const bounds =
      ref.current?.getBoundingClientRect() ?? {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };

    if (orientation === "vertical") {
      return val - bounds.y - bounds.height / 2;
    }

    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

  const widthTransformIcon = useTransform(
    distance,
    [-150, 0, 150],
    [20, 40, 20],
  );
  const heightTransformIcon = useTransform(
    distance,
    [-150, 0, 150],
    [20, 40, 20],
  );

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const widthIcon = useSpring(widthTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const heightIcon = useSpring(heightTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const [hovered, setHovered] = useState(false);

  return (
    <a href={href}>
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative flex aspect-square items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-400 via-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5 hover:shadow-indigo-400/60"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              className="absolute -top-8 left-1/2 w-fit whitespace-pre rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-slate-100 backdrop-blur"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </a>
  );
}
