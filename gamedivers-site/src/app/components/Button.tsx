import "./Button.css";
import type { ComponentPropsWithoutRef, ElementType } from "react";

type ButtonProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & ComponentPropsWithoutRef<T>;

export default function Button<T extends ElementType = "button">({
  as,
  className = "",
  ...props
}: ButtonProps<T>) {
  const Comp = (as ?? "button") as ElementType;
  return <Comp className={"btn " + className} {...props} />;
}
