import type { HTMLAttributes, Ref } from "react";
import { moduleClasses } from "../core/cx";
import styles from "../styles/GridWrapper.module.css";

const cx = moduleClasses(styles);

interface GridWrapperProps extends HTMLAttributes<HTMLDivElement> {
  hasPadding?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** Source `GridWrapper`: 12 columns (8 below 1025px), max-width 2560px. */
export function GridWrapper({ hasPadding = true, className, children, ref, ...rest }: GridWrapperProps) {
  return (
    <div ref={ref} className={`${cx("gridWrapper", { hasPadding })}${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </div>
  );
}
