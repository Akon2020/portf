"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets uncontrolled fields after a form action completes, which
 * would erase what the user typed when validation fails. Submitting through
 * onSubmit inside a transition keeps the values on screen.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
