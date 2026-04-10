import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, 
  MessageSquare, 
  Image as ImageIcon, 
  AlertTriangle, 
  Heart, 
  Search, 
  Send, 
  Info, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  UserX,
  Lock,
  PhoneCall,
  HelpCircle,
  Globe,
  Gamepad2,
  Fingerprint,
  Trophy,
  LogOut,
  BookOpen,
  ExternalLink,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { analyzeContent, getSupportResponse, analyzeImage, scanPrivacyExposure, generateSafetyQuiz, SafetyAnalysis, PrivacyLeak, QuizQuestion } from "@/src/lib/gemini";
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User, db, doc, setDoc, updateDoc, increment, onSnapshot, serverTimestamp } from "@/src/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

// --- Types ---
interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [safetyScore, setSafetyScore] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [scanText, setScanText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SafetyAnalysis | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("");
  
  // New Features State
  const [privacyIdentifier, setPrivacyIdentifier] = useState("");
  const [isPrivacyScanning, setIsPrivacyScanning] = useState(false);
  const [privacyLeaks, setPrivacyLeaks] = useState<PrivacyLeak[]>([]);
  
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState<number | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "1",
      role: "model",
      text: "Hi there. I'm SafeGuard AI. I'm here to listen and help you stay safe online. How are you feeling today?",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync safety score from Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const unsubDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSafetyScore(data.safetyScore || 0);
            setAchievements(data.achievements || []);
          } else {
            // Initialize user doc if it doesn't exist
            setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              safetyScore: 0,
              achievements: [],
              createdAt: serverTimestamp()
            });
          }
        });
        return () => unsubDoc();
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateSafetyScore = async (points: number, achievement?: string) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    try {
      const updateData: any = {
        safetyScore: increment(points)
      };
      if (achievement && !achievements.includes(achievement)) {
        updateData.achievements = [...achievements, achievement];
        toast.success("New Achievement Unlocked!", {
          description: achievement,
          icon: <Trophy className="w-5 h-5 text-amber-500" />
        });
      }
      await updateDoc(userDocRef, updateData);
    } catch (error) {
      console.error("Error updating safety score:", error);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        toast.success("Account created!");
      } else {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        toast.success("Welcome back!");
      }
    } catch (error: any) {
      toast.error("Authentication failed", {
        description: error.message
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in with Google");
    } catch (error: any) {
      toast.error("Google sign-in failed", {
        description: error.message
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!scanText.trim() && !selectedImage) return;
    setIsScanning(true);
    setScanResult(null);
    try {
      let result: SafetyAnalysis;
      if (selectedImage) {
        const base64Data = selectedImage.split(",")[1];
        result = await analyzeImage(base64Data, imageMimeType);
      } else {
        result = await analyzeContent(scanText);
      }
      
      setScanResult(result);
      if (result.isToxic) {
        toast.error("Potential safety risk detected", {
          description: "This content contains toxic elements."
        });
      } else {
        toast.success("Content looks safe", {
          description: "No immediate threats detected."
        });
        updateSafetyScore(5, "Content Guardian");
      }
    } catch (error) {
      toast.error("Analysis failed", {
        description: "Please try again later."
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: chatInput,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const response = await getSupportResponse(chatInput, history);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: response || "I'm sorry, I'm having trouble responding right now.",
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      toast.error("Chat failed", {
        description: "Could not connect to SafeGuard AI."
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handlePrivacyScan = async () => {
    if (!privacyIdentifier.trim()) return;
    setIsPrivacyScanning(true);
    try {
      const leaks = await scanPrivacyExposure(privacyIdentifier);
      setPrivacyLeaks(leaks);
      toast.info("Footprint scan complete", {
        description: `Found ${leaks.length} potential exposure points.`
      });
    } catch (error) {
      toast.error("Scan failed");
    } finally {
      setIsPrivacyScanning(false);
    }
  };

  const startQuiz = async () => {
    setIsQuizLoading(true);
    try {
      const questions = await generateSafetyQuiz();
      setQuizQuestions(questions);
      setCurrentQuizIndex(0);
      setQuizScore(0);
      setShowQuizResult(false);
      setQuizAnswered(null);
      setActiveTab("quest");
    } catch (error) {
      toast.error("Failed to load quiz");
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleQuizAnswer = (index: number) => {
    if (quizAnswered !== null) return;
    setQuizAnswered(index);
    if (index === quizQuestions[currentQuizIndex].correctIndex) {
      setQuizScore(prev => prev + 1);
      toast.success("Correct!", { duration: 1500 });
    } else {
      toast.error("Not quite right", { duration: 1500 });
    }
  };

  const nextQuizQuestion = () => {
    if (currentQuizIndex + 1 < quizQuestions.length) {
      setCurrentQuizIndex(prev => prev + 1);
      setQuizAnswered(null);
    } else {
      setShowQuizResult(true);
      if (quizScore === quizQuestions.length) {
        updateSafetyScore(20, "Safety Expert");
      } else {
        updateSafetyScore(10);
      }
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-2xl">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto bg-indigo-600 p-3 rounded-2xl w-fit">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">SafeGuard AI</CardTitle>
              <CardDescription>
                {isSignUp ? "Create an account to get started" : "Sign in to access your safety companion"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
                  {isSignUp ? "Sign Up" : "Sign In"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or continue with</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-11 gap-2" 
                onClick={handleGoogleLogin}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <p className="text-sm text-center text-slate-600">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
              <Separator />
              <p className="text-xs text-center text-slate-500">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">SafeGuard <span className="text-indigo-600">AI</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setActiveTab("dashboard")} className={`text-sm font-medium transition-colors ${activeTab === "dashboard" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Dashboard</button>
            <button onClick={() => setActiveTab("scanner")} className={`text-sm font-medium transition-colors ${activeTab === "scanner" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Scanner</button>
            <button onClick={() => setActiveTab("footprint")} className={`text-sm font-medium transition-colors ${activeTab === "footprint" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Footprint</button>
            <button onClick={() => setActiveTab("quest")} className={`text-sm font-medium transition-colors ${activeTab === "quest" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Quest</button>
            <button onClick={() => setActiveTab("resources")} className={`text-sm font-medium transition-colors ${activeTab === "resources" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Resources</button>
            <button onClick={() => setActiveTab("chat")} className={`text-sm font-medium transition-colors ${activeTab === "chat" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Chat</button>
            <button onClick={() => setActiveTab("emergency")} className={`text-sm font-medium transition-colors ${activeTab === "emergency" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>Emergency</button>
          </nav>
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 px-3 py-1 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Safety Score: {safetyScore}%
              </Badge>
            </motion.div>
            <Avatar className="w-8 h-8 border">
              <AvatarImage src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} />
              <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border-none shadow-sm bg-indigo-600 text-white overflow-hidden relative">
                  <motion.div 
                    className="absolute top-0 right-0 p-8 opacity-10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Shield className="w-48 h-48" />
                  </motion.div>
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
                    <CardDescription className="text-indigo-100 text-lg">
                      Your digital world is currently stable. Your safety score is {safetyScore}%.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-8">
                    <div className="flex items-center gap-4">
                      <Button variant="secondary" onClick={() => setActiveTab("scanner")} className="bg-white text-indigo-600 hover:bg-indigo-50">
                        Scan New Content
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab("chat")} className="border-white/30 text-white hover:bg-white/10">
                        Talk to SafeGuard
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-white opacity-50" />
                  <CardHeader className="relative">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      Safety Vault
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {achievements.length > 0 ? achievements.map((ach, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1, y: [0, -5, 0] }}
                          transition={{ 
                            scale: { type: "spring", damping: 12 },
                            y: { duration: 3 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" }
                          }}
                        >
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200">
                            {ach}
                          </Badge>
                        </motion.div>
                      )) : (
                        <p className="text-xs text-slate-400 italic">Complete tasks to unlock badges.</p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">Recent Activity</p>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="mt-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Score Updated</p>
                          <p className="text-xs text-slate-500">Your safety score is now {safetyScore}%.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { title: "Cyberbullying", icon: UserX, color: "text-rose-500", bg: "bg-rose-50", desc: "Detection & blocking" },
                  { title: "Photo Privacy", icon: Lock, color: "text-indigo-500", bg: "bg-indigo-50", desc: "Image misuse alerts" },
                  { title: "Fake Accounts", icon: Search, color: "text-amber-500", bg: "bg-amber-50", desc: "Identity protection" },
                  { title: "Mental Health", icon: Heart, color: "text-emerald-500", bg: "bg-emerald-50", desc: "Emotional support" },
                ].map((item, i) => (
                  <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                      <div className={`${item.bg} p-4 rounded-2xl group-hover:scale-110 transition-transform`}>
                        <item.icon className={`w-8 h-8 ${item.color}`} />
                      </div>
                      <h3 className="font-bold text-slate-900">{item.title}</h3>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "scanner" && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">AI Content Scanner</h2>
                <p className="text-slate-500">Check messages or images for harmful content.</p>
              </div>

              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" onClick={() => { setSelectedImage(null); setScanResult(null); }}>Text Scan</TabsTrigger>
                  <TabsTrigger value="image" onClick={() => { setScanText(""); setScanResult(null); }}>Image Scan</TabsTrigger>
                </TabsList>
                <TabsContent value="text">
                  <Card className="border-none shadow-lg overflow-hidden">
                    <CardHeader className="bg-white border-b">
                      <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Input Text</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <textarea
                        value={scanText}
                        onChange={(e) => setScanText(e.target.value)}
                        placeholder="Paste the text here..."
                        className="w-full h-48 p-6 text-lg resize-none focus:outline-none bg-white"
                      />
                    </CardContent>
                    <CardFooter className="bg-slate-50 p-4 flex justify-between items-center">
                      <p className="text-xs text-slate-400">Your data is analyzed privately.</p>
                      <Button 
                        onClick={handleScan} 
                        disabled={isScanning || !scanText.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isScanning ? "Analyzing..." : "Analyze Now"}
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="image">
                  <Card className="border-none shadow-lg overflow-hidden">
                    <CardHeader className="bg-white border-b">
                      <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Upload Image</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-12 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        {selectedImage ? (
                          <div className="relative w-full max-w-xs">
                            <img src={selectedImage} alt="Selected" className="rounded-lg shadow-md max-h-64 mx-auto" referrerPolicy="no-referrer" />
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute -top-2 -right-2 rounded-full w-6 h-6"
                              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center space-y-2">
                            <div className="bg-indigo-100 p-4 rounded-full w-fit mx-auto">
                              <ImageIcon className="w-8 h-8 text-indigo-600" />
                            </div>
                            <p className="font-medium text-slate-900">Click or drag to upload</p>
                            <p className="text-xs text-slate-500">Supports PNG, JPG, WEBP</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50 p-4 flex justify-between items-center">
                      <p className="text-xs text-slate-400">Images are scanned for privacy and safety.</p>
                      <Button 
                        onClick={handleScan} 
                        disabled={isScanning || !selectedImage}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isScanning ? "Analyzing..." : "Analyze Image"}
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>

              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`border-2 ${scanResult.isToxic ? "border-rose-100 bg-rose-50" : "border-emerald-100 bg-emerald-50"}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {scanResult.isToxic ? (
                            <XCircle className="w-6 h-6 text-rose-500" />
                          ) : (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          )}
                          {scanResult.isToxic ? "Potential Risk Detected" : "Content Appears Safe"}
                        </CardTitle>
                        {scanResult.isToxic && (
                          <Badge variant="destructive" className="uppercase">
                            {scanResult.severity} Severity
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-slate-700 leading-relaxed">
                        {scanResult.reason}
                      </p>
                      {scanResult.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="font-bold text-sm text-slate-900">Recommended Actions:</p>
                          <ul className="space-y-1">
                            {scanResult.suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "footprint" && (
            <motion.div
              key="footprint"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Digital Footprint Analyzer</h2>
                <p className="text-slate-500">Discover what information might be exposed online.</p>
              </div>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Privacy Scan</CardTitle>
                  <CardDescription>Enter your social media handle or email to simulate a footprint scan.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3">
                  <Input 
                    value={privacyIdentifier}
                    onChange={(e) => setPrivacyIdentifier(e.target.value)}
                    placeholder="e.g. @username or email@example.com"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handlePrivacyScan} 
                    disabled={isPrivacyScanning || !privacyIdentifier.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isPrivacyScanning ? "Scanning..." : "Start Scan"}
                  </Button>
                </CardContent>
              </Card>

              {privacyLeaks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {privacyLeaks.map((leak, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card className="border-none shadow-sm h-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant={leak.riskLevel === "high" ? "destructive" : "secondary"}>
                              {leak.riskLevel.toUpperCase()} RISK
                            </Badge>
                            <span className="text-xs font-bold text-slate-400">{leak.platform}</span>
                          </div>
                          <CardTitle className="text-base mt-2">{leak.type}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-slate-600 italic">"{leak.exposure}"</p>
                          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-700 uppercase mb-1">How to fix:</p>
                            <p className="text-xs text-indigo-900">{leak.fix}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "quest" && (
            <motion.div
              key="quest"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              {quizQuestions.length === 0 ? (
                <Card className="border-none shadow-xl text-center p-12 space-y-6">
                  <div className="bg-amber-100 p-6 rounded-full w-fit mx-auto">
                    <Gamepad2 className="w-12 h-12 text-amber-600" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-3xl">Safety Quest</CardTitle>
                    <CardDescription className="text-lg">Test your digital safety knowledge and earn badges.</CardDescription>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={startQuiz} 
                    disabled={isQuizLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 px-8"
                  >
                    {isQuizLoading ? "Preparing Quest..." : "Start Quest"}
                  </Button>
                </Card>
              ) : showQuizResult ? (
                <Card className="border-none shadow-xl text-center p-12 space-y-6">
                  <div className="bg-emerald-100 p-6 rounded-full w-fit mx-auto">
                    <Trophy className="w-12 h-12 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-3xl">Quest Complete!</CardTitle>
                    <CardDescription className="text-lg">You scored {quizScore} out of {quizQuestions.length}</CardDescription>
                  </div>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={startQuiz}>Try Again</Button>
                    <Button onClick={() => setActiveTab("dashboard")}>Back to Dashboard</Button>
                  </div>
                </Card>
              ) : (
                <Card className="border-none shadow-xl overflow-hidden">
                  <div className="h-2 bg-slate-100 w-full">
                    <motion.div 
                      className="h-full bg-indigo-600" 
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
                    />
                  </div>
                  <CardHeader>
                    <div className="flex justify-between items-center mb-4">
                      <Badge variant="outline">Question {currentQuizIndex + 1} of {quizQuestions.length}</Badge>
                      <span className="text-sm font-bold text-indigo-600">Score: {quizScore}</span>
                    </div>
                    <CardTitle className="text-xl leading-relaxed">
                      {quizQuestions[currentQuizIndex].scenario}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {quizQuestions[currentQuizIndex].options.map((option, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className={`w-full justify-start h-auto py-4 px-6 text-left whitespace-normal border-2 transition-all ${
                          quizAnswered === i 
                            ? i === quizQuestions[currentQuizIndex].correctIndex
                              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                              : "border-rose-500 bg-rose-50 text-rose-900"
                            : "hover:border-indigo-200 hover:bg-indigo-50"
                        }`}
                        onClick={() => handleQuizAnswer(i)}
                        disabled={quizAnswered !== null}
                      >
                        <span className="mr-3 font-bold opacity-50">{String.fromCharCode(65 + i)}.</span>
                        {option}
                      </Button>
                    ))}
                  </CardContent>
                  <AnimatePresence>
                    {quizAnswered !== null && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="px-6 pb-6"
                      >
                        <div className={`p-4 rounded-xl text-sm ${
                          quizAnswered === quizQuestions[currentQuizIndex].correctIndex
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            : "bg-rose-50 text-rose-800 border border-rose-100"
                        }`}>
                          <p className="font-bold mb-1">
                            {quizAnswered === quizQuestions[currentQuizIndex].correctIndex ? "Correct!" : "Incorrect"}
                          </p>
                          <p>{quizQuestions[currentQuizIndex].explanation}</p>
                        </div>
                        <Button 
                          className="w-full mt-4 bg-slate-900 hover:bg-slate-800"
                          onClick={nextQuizQuestion}
                        >
                          {currentQuizIndex + 1 === quizQuestions.length ? "Finish Quest" : "Next Question"}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === "resources" && (
            <motion.div
              key="resources"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Safety & Support Resources</h2>
                <p className="text-slate-500 text-lg">Curated links to help you navigate the digital world safely and find support when you need it.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Mental Health Support */}
                <Card className="border-none shadow-lg hover:shadow-xl transition-all group">
                  <CardHeader className="pb-4">
                    <div className="bg-rose-100 p-3 rounded-2xl w-fit mb-2 group-hover:scale-110 transition-transform">
                      <Heart className="w-6 h-6 text-rose-600" />
                    </div>
                    <CardTitle className="text-xl">Mental Health</CardTitle>
                    <CardDescription>Professional support for your emotional well-being.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: "AASRA Helpline", desc: "24/7 suicide prevention & counseling", link: "http://www.aasra.info/" },
                      { name: "iCall (TISS)", desc: "Psychosocial helpline by professionals", link: "https://icallhelpline.org/" },
                      { name: "Vandrevala Foundation", desc: "Mental health support via chat/call", link: "https://www.vandrevalafoundation.com/" }
                    ].map((res, i) => (
                      <a 
                        key={i} 
                        href={res.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-100 transition-all group/item"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover/item:text-rose-700">{res.name}</p>
                          <p className="text-[10px] text-slate-500">{res.desc}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover/item:text-rose-500" />
                      </a>
                    ))}
                  </CardContent>
                </Card>

                {/* Cyberbullying Reporting */}
                <Card className="border-none shadow-lg hover:shadow-xl transition-all group">
                  <CardHeader className="pb-4">
                    <div className="bg-amber-100 p-3 rounded-2xl w-fit mb-2 group-hover:scale-110 transition-transform">
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <CardTitle className="text-xl">Reporting Hub</CardTitle>
                    <CardDescription>Official channels to report online crimes and abuse.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: "CyberCrime.gov.in", desc: "National Cyber Crime Reporting Portal", link: "https://www.cybercrime.gov.in/" },
                      { name: "Instagram Safety", desc: "Report bullying on Instagram", link: "https://help.instagram.com/547601325292351" },
                      { name: "TikTok Safety Center", desc: "Reporting tools for TikTok", link: "https://www.tiktok.com/safety/en/reporting/" }
                    ].map((res, i) => (
                      <a 
                        key={i} 
                        href={res.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-100 transition-all group/item"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover/item:text-amber-700">{res.name}</p>
                          <p className="text-[10px] text-slate-500">{res.desc}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover/item:text-amber-500" />
                      </a>
                    ))}
                  </CardContent>
                </Card>

                {/* Online Safety Tips */}
                <Card className="border-none shadow-lg hover:shadow-xl transition-all group">
                  <CardHeader className="pb-4">
                    <div className="bg-indigo-100 p-3 rounded-2xl w-fit mb-2 group-hover:scale-110 transition-transform">
                      <BookOpen className="w-6 h-6 text-indigo-600" />
                    </div>
                    <CardTitle className="text-xl">Safety Tips</CardTitle>
                    <CardDescription>Learn how to protect yourself and your data.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: "ConnectSafely", desc: "Guides for parents and teens", link: "https://www.connectsafely.org/" },
                      { name: "StaySafeOnline", desc: "Cybersecurity awareness and tips", link: "https://staysafeonline.org/" },
                      { name: "Google Safety Center", desc: "Tools for online security", link: "https://safety.google/" }
                    ].map((res, i) => (
                      <a 
                        key={i} 
                        href={res.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 transition-all group/item"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover/item:text-indigo-700">{res.name}</p>
                          <p className="text-[10px] text-slate-500">{res.desc}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover/item:text-indigo-500" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden relative">
                <motion.div 
                  className="absolute -right-12 -bottom-12 opacity-10"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 10, repeat: Infinity }}
                >
                  <Users className="w-64 h-64" />
                </motion.div>
                <CardHeader>
                  <CardTitle>Community Support</CardTitle>
                  <CardDescription className="text-slate-400">You are not alone. There are millions of people and organizations ready to help.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                    If you're feeling overwhelmed, remember that reaching out is a sign of strength. Whether it's a friend, a teacher, or one of the professional services listed above, talking about your experiences is the first step toward resolution and healing.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col"
            >
              <Card className="flex-1 flex flex-col border-none shadow-xl overflow-hidden">
                <CardHeader className="border-b bg-white flex flex-row items-center gap-4 py-4">
                  <div className="bg-indigo-100 p-2 rounded-full">
                    <Shield className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">SafeGuard AI Companion</CardTitle>
                    <CardDescription className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Always here for you
                    </CardDescription>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-0 overflow-hidden">
                  <ScrollArea className="h-full p-6" ref={scrollRef}>
                    <div className="space-y-6">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`flex gap-3 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                            <Avatar className="w-8 h-8 shrink-0 border">
                              <AvatarImage src={msg.role === "user" ? "https://api.dicebear.com/7.x/avataaars/svg?seed=Ram" : "https://api.dicebear.com/7.x/bottts/svg?seed=SafeGuard"} />
                              <AvatarFallback>{msg.role === "user" ? "U" : "AI"}</AvatarFallback>
                            </Avatar>
                            <div className={`space-y-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                              <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                msg.role === "user" 
                                  ? "bg-indigo-600 text-white rounded-tr-none" 
                                  : "bg-white text-slate-700 border rounded-tl-none"
                              }`}>
                                {msg.text}
                              </div>
                              <p className="text-[10px] text-slate-400 px-1">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="flex gap-3">
                            <Avatar className="w-8 h-8 shrink-0 border">
                              <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=SafeGuard" />
                              <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                            <div className="bg-white border p-4 rounded-2xl rounded-tl-none flex gap-1">
                              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>

                <CardFooter className="p-4 border-t bg-white">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex w-full gap-2"
                  >
                    <Input 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type your message here..."
                      className="flex-1 bg-slate-50 border-none focus-visible:ring-indigo-500"
                    />
                    <Button type="submit" size="icon" disabled={!chatInput.trim() || isTyping} className="bg-indigo-600 hover:bg-indigo-700">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {activeTab === "emergency" && (
            <motion.div
              key="emergency"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-rose-600">Emergency Hub</h2>
                <p className="text-slate-500 text-lg">If you're in immediate danger or need urgent help, use these resources.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-2 border-rose-100 bg-rose-50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-rose-700">
                      <PhoneCall className="w-5 h-5" />
                      Helplines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-rose-100">
                      <div>
                        <p className="font-bold text-slate-900">Cyber Crime Helpline</p>
                        <p className="text-sm text-slate-500">National reporting portal</p>
                      </div>
                      <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50">1930</Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-rose-100">
                      <div>
                        <p className="font-bold text-slate-900">Childline India</p>
                        <p className="text-sm text-slate-500">24/7 support for children</p>
                      </div>
                      <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50">1098</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                      Quick Reporting
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start gap-3 h-12">
                      <div className="bg-indigo-100 p-1.5 rounded-md"><ImageIcon className="w-4 h-4 text-indigo-600" /></div>
                      Report Image Misuse
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3 h-12">
                      <div className="bg-amber-100 p-1.5 rounded-md"><UserX className="w-4 h-4 text-amber-600" /></div>
                      Report Impersonation
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3 h-12">
                      <div className="bg-rose-100 p-1.5 rounded-md"><HelpCircle className="w-4 h-4 text-rose-600" /></div>
                      Legal Guidance
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm bg-slate-900 text-white">
                <CardHeader>
                  <CardTitle>Safety Checklist</CardTitle>
                  <CardDescription className="text-slate-400">Steps to take if you are being bullied</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { title: "Don't Respond", desc: "Bullies want a reaction. Stay calm and don't engage." },
                      { title: "Save Evidence", desc: "Take screenshots of messages, comments, and profiles." },
                      { title: "Tell Someone", desc: "Talk to a parent, teacher, or a trusted adult immediately." },
                    ].map((step, i) => (
                      <div key={i} className="space-y-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                          {i + 1}
                        </div>
                        <h4 className="font-bold">{step.title}</h4>
                        <p className="text-sm text-slate-400">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 opacity-50">
            <Shield className="w-5 h-5" />
            <span className="font-bold">SafeGuard AI</span>
          </div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Empowering teenagers to reclaim their digital space. Built with empathy and AI to ensure no one has to face the internet in fear.
          </p>
          <div className="flex justify-center gap-6 text-xs text-slate-400">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
