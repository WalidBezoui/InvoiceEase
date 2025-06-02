
"use client";

import { useState, useEffect, type ChangeEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NextImage from "next/image"; // Renamed to avoid conflict with Lucide icon
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { UploadCloud, Trash2, Loader2, Image as ImageIcon } from "lucide-react"; // Added ImageIcon
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const MAX_FILE_SIZE_KB = 200; 
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;

export default function WatermarkUploader() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [currentWatermarkDataUrl, setCurrentWatermarkDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingWatermark, setIsLoadingWatermark] = useState(true);

  useEffect(() => {
    async function fetchCurrentWatermark() {
      if (user) {
        setIsLoadingWatermark(true);
        try {
          const prefDocRef = doc(db, "userPreferences", user.uid);
          const docSnap = await getDoc(prefDocRef);
          if (docSnap.exists() && docSnap.data().watermarkLogoDataUrl) {
            setCurrentWatermarkDataUrl(docSnap.data().watermarkLogoDataUrl);
          } else {
            setCurrentWatermarkDataUrl(null);
          }
        } catch (error) {
          console.error("Error fetching current watermark:", error);
          toast({
            title: "Error fetching watermark",
            description: "Could not load your current watermark logo.",
            variant: "destructive",
          });
          setCurrentWatermarkDataUrl(null);
        } finally {
          setIsLoadingWatermark(false);
        }
      } else {
        setCurrentWatermarkDataUrl(null);
        setIsLoadingWatermark(false);
      }
    }
    fetchCurrentWatermark();
  }, [user, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File too large", description: `Please select an image smaller than ${MAX_FILE_SIZE_KB}KB.`, variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'].includes(selectedFile.type)) {
        toast({ title: "Invalid file type", description: "Please select a JPG, PNG, GIF or SVG image.", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewDataUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSaveWatermark = async () => {
    if (!file || !user || !previewDataUrl) return;
    setIsProcessing(true);
    try {
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      await setDoc(userPrefDocRef, { watermarkLogoDataUrl: previewDataUrl }, { merge: true });
      
      setCurrentWatermarkDataUrl(previewDataUrl);
      setFile(null);
      setPreviewDataUrl(null); 
      toast({ title: "Watermark Saved", description: "Your invoice watermark logo has been updated." });
    } catch (error) {
      console.error("Error saving watermark:", error);
      toast({ title: "Save Failed", description: "Could not save your watermark. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteWatermark = async () => {
    if (!user || !currentWatermarkDataUrl) return;
    setIsProcessing(true);
    try {
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      await updateDoc(userPrefDocRef, { watermarkLogoDataUrl: null }); 

      setCurrentWatermarkDataUrl(null);
      setFile(null); 
      setPreviewDataUrl(null);
      toast({ title: "Watermark Removed", description: "Your invoice watermark logo has been removed." });
    } catch (error) {
      console.error("Error deleting watermark:", error);
      toast({ title: "Deletion Failed", description: "Could not remove your watermark. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <Card className="bg-secondary/30">
      <CardHeader>
        <CardTitle className="font-headline text-lg text-primary flex items-center">
          <ImageIcon className="mr-2 h-5 w-5 text-accent" /> Invoice Watermark Logo
        </CardTitle>
        <CardDescription>Upload a logo to be used as a subtle background watermark on your invoices. Max {MAX_FILE_SIZE_KB}KB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="watermark-upload" className="font-medium">Choose Watermark File</Label>
          <Input id="watermark-upload" type="file" accept="image/png, image/jpeg, image/gif, image/svg+xml" onChange={handleFileChange} className="file:text-primary file:font-medium"/>
        </div>

        {isLoadingWatermark && (
           <div className="w-full h-32 flex items-center justify-center bg-muted rounded-md">
             <Loader2 className="h-8 w-8 text-primary animate-spin" />
           </div>
        )}

        {!isLoadingWatermark && (previewDataUrl || currentWatermarkDataUrl) && (
          <div className="mt-4 p-4 border rounded-md bg-card flex flex-col items-center space-y-4">
            <p className="text-sm font-medium text-foreground">{previewDataUrl ? "New Watermark Preview:" : "Current Watermark:"}</p>
            <NextImage 
                src={previewDataUrl || currentWatermarkDataUrl || "https://placehold.co/150x150.png?text=Watermark"} 
                alt="Invoice Watermark" 
                width={150} 
                height={150} 
                className="object-contain rounded border p-2 bg-slate-100"
                data-ai-hint="logo watermark"
            />
            {currentWatermarkDataUrl && !previewDataUrl && (
               <Button variant="destructive" onClick={handleDeleteWatermark} disabled={isProcessing} size="sm">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Remove Current Watermark
              </Button>
            )}
          </div>
        )}
        
        {file && previewDataUrl && (
          <Button onClick={handleSaveWatermark} disabled={isProcessing || !file} className="w-full md:w-auto">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Save New Watermark
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
