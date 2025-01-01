"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { BookReader } from "@/components/book-reader";
import { ReaderControls } from "@/components/reader-controls";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { GetBookInfo } from "@/lib/api";

// Add static paths for build time
export async function generateStaticParams() {
  // In a real app, this would come from your data source
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' }
  ];
}


export default function BookPage({ params }: { params: { id: string } }) {
  const [showControls, setShowControls] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [currentPage, setCurrentPage] = useState(1);
  const [total_page, setTotalPage] = useState(0);

  // Hide controls after 3 seconds of inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    const handleBookInfo = async () => {
      const response = await GetBookInfo(parseInt(params.id));
      if (response.status) {
        if (typeof response.message !== "string") {
          if (response.message.total_page !== null) {
            setTotalPage(response.message.total_page);
          }
          const currPage = localStorage.getItem(response.message.title)
          if (currPage) {
            setCurrentPage(parseInt(currPage))
          } else {
            localStorage.setItem(response.message.title, currentPage.toString())
          }
        }
      }
    }

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#1A1B1E] text-foreground">
      <ReaderControls
        show={showControls}
        fontSize={fontSize}
        onFontSizeChange={(value) => setFontSize(value[0])}
        onPrevPage={}
        onNextPage={}
        currentPage={currentPage}
        totalPages={234}
      />

      <div className="container max-w-2xl mx-auto px-4 py-16">
        <BookReader
          fontSize={fontSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onClick={() => setShowControls(!showControls)}
          bookId={parseInt(params.id)}
        />
      </div>

      <Link href="/library" className="fixed top-4 left-4">
        <Button variant="ghost" size="sm" className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Library
        </Button>
      </Link>
    </div>
  );
}