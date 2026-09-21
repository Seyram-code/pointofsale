"use client";

import { Search, X } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";

export interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  onSearch: (value: string) => void;
  className?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, defaultValue = "", placeholder = "Search...", debounceMs = 300, autoFocus, onSearch, className },
  ref,
) {
  const [internal, setInternal] = useState(value ?? defaultValue);

  useEffect(() => {
    if (value !== undefined) setInternal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(internal.trim()), debounceMs);
    return () => clearTimeout(timer);
    // onSearch is intentionally excluded; callers commonly pass an inline function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internal, debounceMs]);

  return (
    <Input
      ref={ref}
      type="search"
      inputMode="search"
      autoFocus={autoFocus}
      value={internal}
      placeholder={placeholder}
      containerClassName={className}
      leftIcon={<Search className="size-4" />}
      onChange={(event) => setInternal(event.target.value)}
      rightSlot={
        internal ? (
          <button type="button" aria-label="Clear search" onClick={() => setInternal("")} className="pointer-events-auto">
            <X className="size-4" />
          </button>
        ) : undefined
      }
    />
  );
});
