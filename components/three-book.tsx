/* "use client";

import { useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three/src/loaders/TextureLoader";
import { Text } from "@react-three/drei";
import { Mesh } from "three";
import { BookCoverResponse } from "@/lib/definitions";

interface BookModelProps {
  book: BookCoverResponse;
  coverUrl: string;
}

function BookModel({ book, coverUrl }: BookModelProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(0);
  
  // Load textures
  const coverTexture = useLoader(TextureLoader, coverUrl);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Auto-rotation
      meshRef.current.rotation.y += rotationSpeed * delta;
      
      // Smooth rotation speed decay
      if (rotationSpeed !== 0) {
        setRotationSpeed(current => current * 0.95);
      }
    }
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    const x = e.point.x;
    setRotationSpeed(x > 0 ? -2 : 2);
  };

  return (
    <group
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
    >
      {/* Book cover (front) }
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[3, 4, 0.3]} />
        <meshStandardMaterial
          map={coverTexture}
          attach="material-4"
        />
        <meshStandardMaterial
          color="#1a1a1a"
          attach="material-0"
          metalness={0.5}
          roughness={0.7}
        />
        <meshStandardMaterial
          color="#2a2a2a"
          attach="material-1"
          metalness={0.5}
          roughness={0.7}
        />
        <meshStandardMaterial
          color="#1a1a1a"
          attach="material-2"
          metalness={0.5}
          roughness={0.7}
        />
        <meshStandardMaterial
          color="#2a2a2a"
          attach="material-3"
          metalness={0.5}
          roughness={0.7}
        />
        {/* Back cover with text }
        <meshStandardMaterial
          color="#f5f5f5"
          attach="material-5"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>

      {/* Back cover text }
      <group position={[0, 0, -0.2]} rotation={[0, Math.PI, 0]}>
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.2}
          color="#333333"
          maxWidth={2.5}
          textAlign="center"
          font="/fonts/inter-var.woff2"
        >
          {book.title}
        </Text>
        <Text
          position={[0, 1, 0]}
          fontSize={0.15}
          color="#666666"
          maxWidth={2.5}
          textAlign="center"
        >
          by {book.author || "Unknown"}
        </Text>
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.12}
          color="#666666"
          maxWidth={2.5}
          textAlign="justify"
        >
          {book.description || "No description available"}
        </Text>
        <Text
          position={[0, -1, 0]}
          fontSize={0.12}
          color="#666666"
          maxWidth={2.5}
          textAlign="center"
        >
          {`Published: ${book.production_year || "Unknown"}`}
          {`\nPages: ${book.total_page || "Unknown"}`}
          {`\nUploaded by: ${book.user}`}
        </Text>
      </group>

      {/* Spine text }
      <Text
        position={[-1.55, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.2}
        color="#ffffff"
        maxWidth={3.5}
        textAlign="center"
      >
        {book.title}
      </Text>
    </group>
  );
}

interface ThreeBookProps {
  book: BookCoverResponse;
}

export function ThreeBook({ book }: ThreeBookProps) {
  return (
    <div className="w-full h-[600px]">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <BookModel
          book={book}
          coverUrl={book.book_cover || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e"}
        />
      </Canvas>
    </div>
  );
} */



  
/* "use client";

import { useState, useEffect } from "react";

import dynamic from "next/dynamic";

const ThreeBook = dynamic(() => import("@/components/three-book"), {
  ssr: false, // Prevents server-side rendering
});

import { BookCoverResponse } from "@/lib/definitions";
import { GetBookInfo, UpdateBookInfo, DeleteBookInfo } from "@/lib/api";
import { useRouter, useParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Edit, Trash2, BookHeadphonesIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function BookPage() {
  const params = useParams();
  const path = usePathname();

  const [book, setBook] = useState<BookCoverResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    const fetchBook = async () => {
      const data = await GetBookInfo(parseInt(id as string));
      if (data.status && typeof data.message !== "string") {
        setBook(data.message);
      } else {
        router.push("/404");
      }
    };

    fetchBook();
  }, [id, router]);

  const handleStatusChange = async (newStatus: string) => {
    if (!book) return;
    
    setIsUpdating(true);
    const result = await UpdateBookInfo(book.id, { status: newStatus });
    setIsUpdating(false);

    if (result.status && typeof result.message !== "string") {
      setBook(result.message);
      toast({
        title: "Status Updated",
        description: `Book status changed to ${newStatus}`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update book status",
      });
    }
  };

  const handleDelete = async () => {
    if (!book) return;

    const result = await DeleteBookInfo(book.id);
    
    if (result.status) {
      toast({
        title: "Book Deleted",
        description: "Book has been successfully deleted",
      });
      router.push("/library");
    } else {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete book",
      });
    }
  };

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const handleOnePage = () => {
    router.push(`${path}/read`);
  };
  
  const handleAllPage = () => {
    router.push(`${path}/read-all`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="container max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Book Model Section }
          <div className="flex flex-col space-y-4">
            <div className="w-full bg-gradient-to-b from-background to-muted rounded-lg p-4">
              <ThreeBook book={book} />
              <p className="text-center text-sm text-muted-foreground mt-4">
                Click and drag to rotate the book
              </p>
            </div>
            <div className="flex flex-row md:flex-col gap-4 justify-between mt-4">
              <Button className="flex-1" size="lg" onClick={handleOnePage}>
                <Clock className="mr-2 h-4 w-4" />
                Read One Page
              </Button>
              <Button variant="outline" className="flex-1" size="lg" onClick={handleAllPage}>
                <BookHeadphonesIcon className="mr-2 h-4 w-4" />
                Read all Pages
              </Button>
            </div>
          </div>

          {/* Book Details Section }
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
              <p className="text-lg text-muted-foreground">
                by {book.author || "Unknown"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground">
                  {book.description || "No description available"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Production Year
                  </h3>
                  <p>{book.production_year || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Status
                  </h3>
                  <div className="flex items-center gap-2">
                    <Select
                      value={book.status}
                      onValueChange={handleStatusChange}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    {isUpdating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Total Pages
                  </h3>
                  <p>{book.total_page || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Uploaded By
                  </h3>
                  <p>{book.user}</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">
                  Last Updated
                </h3>
                <p>{new Date(book.updated_at).toLocaleDateString()}</p>
              </div>

              <div className="pt-4 flex gap-4">
                <Button variant="outline" className="w-full" size="lg">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" size="lg">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Book
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the
                        book and remove it from your library.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} */