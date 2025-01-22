import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BookCardProps {
  title: string;
  author: string;
  coverUrl: string | null;
  progress?: number;
}

export function BookCard({ title, author, coverUrl, progress }: BookCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-[2/3] relative">
        <Image
          src={coverUrl ? coverUrl : "/default-cover.jpg"}
          alt={title ? title : "No title available"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-semibold line-clamp-1">{title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1">{author}</p>
        {progress !== undefined && (
          <Progress value={progress} className="h-1" />
        )}
      </div>
    </Card>
  );
}