/* "use client";

import * as THREE from "three";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";

interface ThreeDBookCardProps {
  title: string;
  author: string;
  coverUrl: string | null;
  description?: string;
  productionYear?: string;
}

function BookModel({ title, author, coverUrl, description, productionYear }: ThreeDBookCardProps) {
  const bookRef = useRef<THREE.Mesh>(null);

  // Load book cover texture
  const texture = useLoader(THREE.TextureLoader, coverUrl || "/default-cover.jpg");

  // Rotate the book slightly on each frame
  useFrame(() => {
    if (bookRef.current) {
      bookRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group>
      {/* Book Mesh /}
      <mesh ref={bookRef}>
        {/* Front Cover *}
        <mesh position={[0, 0, 0.1]}>
          <planeGeometry args={[1, 1.5]} />
          <meshStandardMaterial map={texture} />
        </mesh>

        {/* Back Cover }
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[1, 1.5]} />
          <meshStandardMaterial color="brown" />
        </mesh>

        {/* Spine }
        <mesh position={[-0.5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.2, 1.5]} />
          <meshStandardMaterial color="brown" />
        </mesh>
      </mesh>

      {/* Floating Text for Title and Author }
      <Html position={[0, -1, 0]}>
        <div className="text-center bg-white p-2 shadow-md rounded-md text-sm">
          <p className="font-bold">{title}</p>
          <p className="text-xs text-gray-500">by {author}</p>
        </div>
      </Html>

      {/* Floating Text for Back Cover (Description & Year) }
      <Html position={[0, 0, -0.12]}>
        <div className="bg-white p-2 text-xs shadow-md rounded-md w-40">
          <p className="font-semibold">Description:</p>
          <p className="line-clamp-3">{description || "No description available"}</p>
          <p className="mt-1 font-semibold">Year: {productionYear || "Unknown"}</p>
        </div>
      </Html>
    </group>
  );
}

export default function ThreeDBookCard(props: ThreeDBookCardProps) {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[2, 3, 5]} />
      <BookModel {...props} />
      <OrbitControls />
    </Canvas>
  );
} */
