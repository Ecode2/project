"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookReaderAll } from "@/components/book-reader-all";
import { ReaderControls } from "@/components/reader-controls";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { GetBookInfo } from "@/lib/api";
import { useParams, useRouter, usePathname } from "next/navigation";


export default function BookPage() {

    const params = useParams(); //{ params }: { params: { id: string } }
    const path = usePathname();
    const router = useRouter();

    const [showControls, setShowControls] = useState(true);
    const [fontSize, setFontSize] = useState(16);
    const [currentPage, setCurrentPage] = useState(1);
    const [total_page, setTotalPage] = useState(0);
    const [title, setTitle] = useState<string>("")

    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    useEffect(() => {

        const handleBookInfo = async () => {
            let response = null
            const stored_response = localStorage.getItem(id+"all_page")
            if (stored_response) {
                response = JSON.parse(stored_response)
            }else {
                response = await GetBookInfo(parseInt(id));
                localStorage.setItem(id+"all_page", JSON.stringify(response))
            }

            if (response.status) {
                if (typeof response.message !== "string") {

                    if (response.message.total_page !== null) {
                        setTotalPage(response.message.total_page);
                    }

                    const currPage = localStorage.getItem(response.message.title+id+"all_page")

                    if (currPage) {

                        setCurrentPage(parseInt(currPage))
                        setTitle(response.message.title)

                    } else {
                        localStorage.setItem(response.message.title+id+"all_page", currentPage.toString())
                        setTitle(response.message.title)
                    }
                }
            }

        }
        handleBookInfo()
    }, [currentPage, id]);


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


        return () => {
            window.removeEventListener("mousemove", handleActivity);
            window.removeEventListener("touchstart", handleActivity);
            clearTimeout(timeout);
        };
    }, [id]);


    const handlePrevPage = () => {

        if (currentPage != 1) {
            localStorage.removeItem(title+id+"all_page")
            localStorage.setItem(title+id+"all_page", (currentPage - 1).toString())
            setCurrentPage(currentPage - 1)
        }

    }
    const handleNextPage = () => {

        if (currentPage != total_page) {
            localStorage.removeItem(title+id+"all_page")
            localStorage.setItem(title+id+"all_page", (currentPage + 1).toString())
            setCurrentPage(currentPage + 1)
        }
    }

    const handlePageReload = () => {
		localStorage.removeItem(id+"all_page")
		localStorage.removeItem(title+id+"all_page")
        localStorage.removeItem(title+id+"pages")
		console.log("page reloading")
		return router.push(path);
	}

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#1A1B1E] text-foreground">
            <ReaderControls
                show={showControls}
                fontSize={fontSize}
                onFontSizeChange={(value) => setFontSize(value[0])}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                currentPage={currentPage}
                totalPages={total_page}
                reloadPage={handlePageReload}
            />

            <div className="container max-w-2xl mx-auto px-4 py-16">
                <BookReaderAll
                    fontSize={fontSize}
                    currentPage={currentPage}
                    onClick={() => setShowControls(!showControls)}
                    bookId={parseInt(id)}
                    title={title}
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
