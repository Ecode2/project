"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Sun,
  Moon,
  Type,
} from "lucide-react";
import { useTheme } from "next-themes";

interface ReaderControlsProps {
  show: boolean;
  fontSize: number;
  onFontSizeChange: (value: number[]) => void;
  currentPage: number;
  totalPages: number;
}

export function ReaderControls({
  show,
  fontSize,
  onFontSizeChange,
  currentPage,
  totalPages,
}: ReaderControlsProps) {
  const { theme, setTheme } = useTheme();

  return (
    <>
      {/* Top Controls */}
      <div
        className={`fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-b p-4 transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="container max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Type className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[fontSize]}
              onValueChange={onFontSizeChange}
              min={12}
              max={24}
              step={1}
              className="w-32"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className={`fixed bottom-16 left-0 right-0 bg-background/80 backdrop-blur-lg border-t p-4 transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="container max-w-2xl mx-auto flex justify-between items-center">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="ghost" size="sm">
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </>
  );
}