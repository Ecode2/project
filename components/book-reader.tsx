"use client";

import { cn } from "@/lib/utils";

interface BookReaderProps {
  fontSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onClick: () => void;
  bookId: number
}

export function BookReader({
  fontSize,
  currentPage,
  onPageChange,
  onClick,
  bookId,
}: BookReaderProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "prose dark:prose-invert mx-auto max-w-none",
        "bg-reader_bg text-reader_light dark:bg-reader_bg_dark dark:text-reader_dark",
        "p-8 sm:p-12 rounded-lg shadow-lg",
        "transition-all duration-200 ease-in-out"
      )}
      style={{ fontSize: `${fontSize}px` }}
    >
      <h2 className="text-center mb-8">Chapter 1: The Beginning</h2>
      <p className="leading-relaxed">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </p>
      <p className="leading-relaxed">
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
        dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
        proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
      </p>
    </div>
  );
}