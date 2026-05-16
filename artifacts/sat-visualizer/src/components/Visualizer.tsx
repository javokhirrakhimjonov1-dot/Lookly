import { useState, useRef, useCallback } from "react";
import {
  useVisualizePassage,
  useGetVisualizationStatus,
  getGetVisualizationStatusQueryKey,
  useExtractTextFromImage,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  BookOpen,
  Film,
  Loader2,
  Sparkles,
  ImageIcon,
  Type,
  Upload,
  X,
  CheckCircle2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";

type InputMode = "text" | "image";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Visualizer() {
  const [passage, setPassage] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [uploadedImage, setUploadedImage] = useState<{
    file: File;
    previewUrl: string;
    base64: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const extractMutation = useExtractTextFromImage({
    mutation: {
      onSuccess: (data) => {
        setPassage(data.text);
        setInputMode("text");
      },
    },
  });

  const visualizeMutation = useVisualizePassage({
    mutation: {
      onSuccess: (data) => {
        setJobId(data.jobId);
      },
    },
  });

  const { data: statusData, error: statusError } = useGetVisualizationStatus(
    jobId || "",
    {
      query: {
        enabled: !!jobId,
        queryKey: getGetVisualizationStatusQueryKey(jobId || ""),
        refetchInterval: (query) => {
          if (!jobId) return false;
          const state = query.state.data;
          if (state?.status === "done" || state?.status === "error") return false;
          return 2000;
        },
      },
    }
  );

  const handleVisualize = () => {
    if (passage.length >= 50 && passage.length <= 3000) {
      visualizeMutation.mutate({ data: { passage } });
    }
  };

  const handleReset = () => {
    setPassage("");
    setJobId(null);
    setUploadedImage(null);
    setInputMode("text");
    if (jobId) {
      queryClient.removeQueries({
        queryKey: getGetVisualizationStatusQueryKey(jobId),
      });
    }
    visualizeMutation.reset();
    extractMutation.reset();
  };

  const handleImageFile = useCallback(async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    setUploadedImage({ file, previewUrl, base64 });
    extractMutation.reset();
  }, [extractMutation]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleImageFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) await handleImageFile(file);
    },
    [handleImageFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleExtract = () => {
    if (!uploadedImage) return;
    extractMutation.mutate({
      data: {
        imageBase64: uploadedImage.base64,
        mimeType: uploadedImage.file.type as
          | "image/jpeg"
          | "image/png"
          | "image/webp"
          | "image/gif",
      },
    });
  };

  const charCount = passage.length;
  const isOverLimit = charCount > 3000;
  const isUnderLimit = charCount > 0 && charCount < 50;
  const isValid = charCount >= 50 && !isOverLimit;

  // Processing / done view
  if (jobId || visualizeMutation.isPending) {
    const isDone = statusData?.status === "done";
    const isError = statusData?.status === "error" || !!statusError;
    const scenes = statusData?.scenes || visualizeMutation.data?.scenes || [];
    const thumbnails: string[] = statusData?.thumbnails || [];
    const progress = statusData?.progress || 0;
    const currentStep = statusData?.step || "Initializing visualization...";

    return (
      <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        <Card className="border-2 shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-3">
                {isDone ? (
                  <>
                    <Film className="w-6 h-6" /> Visualization Complete
                  </>
                ) : isError ? (
                  <>
                    <AlertCircle className="w-6 h-6 text-destructive" />{" "}
                    Processing Failed
                  </>
                ) : (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" /> Crafting Your
                    Visuals
                  </>
                )}
              </h2>
              {isDone && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-reset-top"
                >
                  Try Another Passage
                </Button>
              )}
            </div>

            {!isDone && !isError && (
              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-sm font-sans font-medium text-muted-foreground">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            )}
          </div>

          <CardContent className="p-0">
            {isError ? (
              <div className="p-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-destructive/10 rounded-full text-destructive mb-4">
                  <AlertCircle className="w-12 h-12" />
                </div>
                <p className="text-lg text-muted-foreground">
                  {statusData?.error ||
                    "An unexpected error occurred. Please try again with a different passage."}
                </p>
                <Button
                  size="lg"
                  onClick={handleReset}
                  data-testid="button-reset-error"
                >
                  Try Another Passage
                </Button>
              </div>
            ) : isDone ? (
              <div className="bg-black aspect-video w-full relative flex items-center justify-center">
                <video
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  src={`/api/sat-visualizer/video/${jobId}`}
                  data-testid="video-player"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="bg-muted/10 p-6 md:p-8">
                <h3 className="text-lg font-bold mb-6 font-sans text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> Upcoming Scenes
                </h3>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {scenes.map((scene, index) => {
                    const thumb = thumbnails[scene.index];
                    return (
                      <div
                        key={scene.index}
                        className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                        style={{
                          animationDelay: `${index * 150}ms`,
                          animationDuration: "700ms",
                        }}
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-sans font-bold z-10">
                          {scene.index + 1}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                          {thumb ? (
                            <>
                              <img
                                src={`data:image/jpeg;base64,${thumb}`}
                                alt={scene.title}
                                className="w-full aspect-square object-cover animate-in fade-in duration-700"
                              />
                              <div className="p-3">
                                <h4 className="font-bold text-primary mb-0.5 font-serif text-base">
                                  {scene.title}
                                </h4>
                                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                                  "{scene.caption}"
                                </p>
                              </div>
                            </>
                          ) : (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                                <h4 className="font-bold text-primary font-serif text-lg">
                                  {scene.title}
                                </h4>
                              </div>
                              <p className="text-sm text-muted-foreground font-sans leading-relaxed">
                                "{scene.caption}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {scenes.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground font-sans animate-pulse">
                      Analyzing passage structure...
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          {isDone && (
            <div className="p-6 md:p-8 border-t bg-muted/10">
              <h3 className="text-xl font-bold mb-6 text-primary">
                Scene Breakdown
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {scenes.map((scene) => {
                  const thumb = thumbnails[scene.index];
                  return (
                    <div
                      key={scene.index}
                      className="rounded-lg bg-background border overflow-hidden"
                    >
                      {thumb && (
                        <img
                          src={`data:image/jpeg;base64,${thumb}`}
                          alt={scene.title}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      <div className="p-4 flex gap-3">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold font-sans text-sm">
                          {scene.index + 1}
                        </div>
                        <div>
                          <h4 className="font-bold mb-1 font-serif">
                            {scene.title}
                          </h4>
                          <p className="text-sm text-muted-foreground font-sans">
                            {scene.caption}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex justify-center">
                <Button
                  size="lg"
                  onClick={handleReset}
                  data-testid="button-reset-bottom"
                  className="px-8"
                >
                  Visualize Another Passage
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Input form view
  return (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
          SAT Passage Visualizer
        </h1>
        <p className="text-lg text-muted-foreground font-sans max-w-xl mx-auto">
          Transform dense reading passages into clear, animated visual stories.
          Paste your text or upload a screenshot to begin.
        </p>
      </div>

      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 md:p-8">
          {/* Mode tabs */}
          <div className="flex rounded-lg border bg-muted/30 p-1 mb-6">
            <button
              onClick={() => setInputMode("text")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium font-sans transition-all ${
                inputMode === "text"
                  ? "bg-background shadow text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-text"
            >
              <Type className="w-4 h-4" />
              Paste Text
            </button>
            <button
              onClick={() => setInputMode("image")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium font-sans transition-all ${
                inputMode === "image"
                  ? "bg-background shadow text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-image"
            >
              <ImageIcon className="w-4 h-4" />
              Upload Screenshot
            </button>
          </div>

          {inputMode === "text" ? (
            <div className="space-y-4">
              <Textarea
                placeholder="Paste your SAT passage here..."
                className="min-h-[300px] resize-y text-lg leading-relaxed p-6 bg-white/80 focus:bg-white transition-colors border-2 shadow-inner font-serif"
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                data-testid="input-passage"
              />
              <div className="flex items-center justify-between font-sans text-sm">
                <div
                  className={`font-medium ${
                    isOverLimit
                      ? "text-destructive"
                      : isUnderLimit
                      ? "text-muted-foreground"
                      : charCount > 0
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {charCount} / 3000 characters
                  {isUnderLimit && (
                    <span className="ml-2 text-muted-foreground">
                      (Minimum 50 required)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !uploadedImage && fileInputRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : uploadedImage
                    ? "border-primary/40 bg-muted/10 cursor-default"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
                }`}
                data-testid="image-dropzone"
              >
                {uploadedImage ? (
                  <div className="relative">
                    <img
                      src={uploadedImage.previewUrl}
                      alt="Uploaded screenshot"
                      className="w-full max-h-80 object-contain rounded-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedImage(null);
                        extractMutation.reset();
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 border shadow-sm hover:bg-background transition-colors"
                      data-testid="button-remove-image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-base font-medium text-foreground mb-1">
                      Drop a screenshot here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to select a file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG, WebP, or GIF — the AI will read the passage
                      text for you
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFilePick}
                data-testid="input-file"
              />

              {extractMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Extraction Failed</AlertTitle>
                  <AlertDescription>
                    {extractMutation.error?.data?.error ||
                      "Could not read text from the image. Try a clearer screenshot."}
                  </AlertDescription>
                </Alert>
              )}

              {uploadedImage && !extractMutation.isSuccess && (
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-medium shadow-md transition-all hover:shadow-lg"
                  onClick={handleExtract}
                  disabled={extractMutation.isPending}
                  data-testid="button-extract"
                >
                  {extractMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Reading text from image...
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-5 h-5 mr-2" />
                      Extract Text from Screenshot
                    </>
                  )}
                </Button>
              )}

              {extractMutation.isSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm font-medium font-sans">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  Text extracted — switching to text view so you can review it
                  before visualizing.
                </div>
              )}
            </div>
          )}

          {/* Error from visualize mutation */}
          {visualizeMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {visualizeMutation.error?.data?.error ||
                  "Failed to start visualization. Please try again."}
              </AlertDescription>
            </Alert>
          )}

          {/* Visualize button (text mode only) */}
          {inputMode === "text" && (
            <Button
              size="lg"
              className="w-full h-14 text-lg font-medium shadow-md transition-all hover:shadow-lg mt-6"
              onClick={handleVisualize}
              disabled={!isValid}
              data-testid="button-visualize"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Visualize Passage
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
