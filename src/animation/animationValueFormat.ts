import type { AnimationProperty } from "./animationTypes.js";

export function degreesToRotationValue(degrees: number): number {
  return Math.round(((degrees * Math.PI) / 180) * 1000);
}

export function rotationValueToDegrees(value: number): number {
  return (value / 1000) * (180 / Math.PI);
}

export function displayValueForProperty(property: AnimationProperty, value: number): number {
  if (property === "scale_x" || property === "scale_y") {
    return value / 10;
  }

  if (property === "rotation") {
    return rotationValueToDegrees(value);
  }

  if (property === "alpha") {
    return (value / 255) * 100;
  }

  return value;
}

export function storedValueForProperty(property: AnimationProperty, displayValue: number): number {
  if (property === "scale_x" || property === "scale_y") {
    return Math.round(displayValue * 10);
  }

  if (property === "rotation") {
    return degreesToRotationValue(displayValue);
  }

  if (property === "alpha") {
    return Math.round((clamp(displayValue, 0, 100) / 100) * 255);
  }

  return Math.round(displayValue);
}

export function getValueInputConfig(property: AnimationProperty): { label: string; min: number; max: number; step: number } {
  if (property === "scale_x" || property === "scale_y") {
    return {
      label: "Value %",
      min: -3276,
      max: 3276,
      step: 1,
    };
  }

  if (property === "rotation") {
    return {
      label: "Degrees",
      min: -1877,
      max: 1877,
      step: 0.1,
    };
  }

  if (property === "alpha") {
    return {
      label: "Alpha %",
      min: 0,
      max: 100,
      step: 1,
    };
  }

  return {
    label: "Value",
    min: -32768,
    max: 32767,
    step: 1,
  };
}

export function formatDisplayValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
