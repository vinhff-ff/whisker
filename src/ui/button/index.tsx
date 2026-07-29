import "./index.scss";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}

const Button = ({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
  title,
  "aria-label": ariaLabel,
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={`treasure-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      <span>{children}</span>
    </button>
  );
};

export default Button;
