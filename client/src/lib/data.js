import { Heart, DollarSign, BarChart3, Laptop, Leaf, HeartCrack, Scale, MessagesSquare } from 'lucide-react';

export const QUICK_PROBLEMS = [
  { label: "I'm having relationship problems.", icon: Heart, color: 'violet', prompt: "I'm having relationship problems and I don't know how to handle it." },
  { label: 'Help me manage my money.', icon: DollarSign, color: 'green', prompt: 'Help me manage my money. I want a realistic budget and a plan to save.' },
  { label: 'I need a business idea.', icon: BarChart3, color: 'blue', prompt: 'I need a business idea that fits my skills and a small budget.' },
  { label: 'Help me finish my project.', icon: Laptop, color: 'indigo', prompt: "Help me finish my project. I keep getting stuck and I'm behind." },
  { label: 'I feel stuck in life.', icon: Leaf, color: 'lime', prompt: "I feel stuck in life and I don't know what direction to take." },
  { label: 'Someone cheated on me.', icon: HeartCrack, color: 'rose', prompt: "Someone cheated on me. I'm hurt and confused about what to do next." },
  { label: 'Help me make a decision.', icon: Scale, color: 'amber', prompt: "Help me make a decision. I'm torn between options." },
  { label: 'Just talk to me...', icon: MessagesSquare, color: 'purple', prompt: 'Just talk to me for a bit. I need someone to talk to.' },
];

export const CATEGORIES = [
  { id: 'personal', title: 'Personal life', emoji: '🧭', examples: ['Should I move to a new city for a fresh start?', 'How do I rebuild my confidence after failing?', 'My family keeps pressuring me about my career.'] },
  { id: 'relationships', title: 'Relationships', emoji: '💜', examples: ['My partner and I keep having the same argument.', 'I think my girlfriend is hiding something.', 'How do I get over a breakup that I caused?'] },
  { id: 'money', title: 'Money & finance', emoji: '💰', examples: ['I earn 40k a month and save nothing — fix my budget.', 'Should I pay off debt or start investing first?', 'Help me plan a second income stream.'] },
  { id: 'work', title: 'Work & projects', emoji: '🚀', examples: ['Plan the marketing launch for my small online shop.', 'Should I quit my job to freelance?', 'I procrastinate on my thesis every day.'] },
  { id: 'anything', title: 'Anything else', emoji: '✨', examples: ['Explain how inflation affects my savings simply.', 'Write a professional complaint email to my landlord.', 'My laptop is suddenly very slow — troubleshoot with me.'] },
];

export const USEFUL_ACTIONS = [
  { id: 'useful', title: 'Give me something useful to do', emoji: '⚡' },
  { id: 'earn', title: 'Help me earn money', emoji: '💸' },
  { id: 'learn', title: 'Teach me something new', emoji: '🧠' },
  { id: 'creative', title: 'Give me a creative challenge', emoji: '🎨' },
  { id: 'project', title: 'Help me start a project', emoji: '🛠️' },
  { id: 'routine', title: 'Improve my daily routine', emoji: '🌅' },
  { id: 'ten', title: 'Give me a 10-minute productive task', emoji: '⏱️' },
];

export const LIVE_GREETING = "Hello buddy! Welcome to Asad Solvency. I'm here and ready to help. Tell me, what's on your mind today?";
