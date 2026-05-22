import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Friend {
  id: string;
  name: string;
  handle: string;
}

export const SQUAD_FRIENDS: Friend[] = [
  { id: "f1", name: "Dilnoza M.", handle: "dilnoza.style" },
  { id: "f2", name: "Kamola B.", handle: "kamola.looks" },
  { id: "f3", name: "Malika T.", handle: "malikafashion" },
  { id: "f4", name: "Zulfiya R.", handle: "zulfiya_ootd" },
  { id: "f5", name: "Nasiba K.", handle: "nasiba.k" },
  { id: "f6", name: "Shahlo A.", handle: "shahlo.fashion" },
];

export interface PollOutfitData {
  name: string;
  mood: string;
  previewImage?: string;
  items: Array<{ name: string; color: string; category: string }>;
}

export interface PollVote {
  friendName: string;
  response: "heart" | "dislike";
}

export interface Poll {
  id: string;
  creatorId: string;
  creatorName: string;
  outfitData: PollOutfitData;
  sentTo: string[];
  votes: PollVote[];
  expiresAt: string;
  createdAt: string;
}

function stripPollImage(poll: Poll): Poll {
  const { previewImage: _, ...rest } = poll.outfitData;
  return { ...poll, outfitData: rest };
}

const SEED_POLLS: Poll[] = [
  {
    id: "seed_poll_1",
    creatorId: "u1",
    creatorName: "Dilnoza M.",
    outfitData: {
      name: "Spring Office Chic",
      mood: "chic",
      items: [
        { name: "White Blazer", color: "white", category: "outerwear" },
        { name: "Slim Trousers", color: "navy", category: "bottoms" },
        { name: "Block Heels", color: "nude", category: "shoes" },
      ],
    },
    sentTo: ["me", "Malika T.", "Nasiba K."],
    votes: [
      { friendName: "Malika T.", response: "heart" },
      { friendName: "Nasiba K.", response: "heart" },
    ],
    expiresAt: new Date(Date.now() + 5400000).toISOString(),
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "seed_poll_2",
    creatorId: "u2",
    creatorName: "Kamola B.",
    outfitData: {
      name: "Weekend Market Casual",
      mood: "casual",
      items: [
        { name: "Linen Dress", color: "sage", category: "dresses" },
        { name: "Woven Sandals", color: "tan", category: "shoes" },
        { name: "Wicker Bag", color: "natural", category: "accessories" },
      ],
    },
    sentTo: ["me", "Dilnoza M.", "Zulfiya R."],
    votes: [
      { friendName: "Dilnoza M.", response: "heart" },
      { friendName: "Zulfiya R.", response: "dislike" },
    ],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2700000).toISOString(),
  },
  {
    id: "seed_poll_mine",
    creatorId: "me",
    creatorName: "You",
    outfitData: {
      name: "Autumn Street Style",
      mood: "streetwear",
      items: [
        { name: "Oversized Coat", color: "camel", category: "outerwear" },
        { name: "Black Jeans", color: "black", category: "bottoms" },
        { name: "Chunky Sneakers", color: "white", category: "shoes" },
      ],
    },
    sentTo: ["Dilnoza M.", "Kamola B.", "Malika T.", "Nasiba K."],
    votes: [
      { friendName: "Dilnoza M.", response: "heart" },
      { friendName: "Kamola B.", response: "heart" },
      { friendName: "Malika T.", response: "dislike" },
    ],
    expiresAt: new Date(Date.now() + 2700000).toISOString(),
    createdAt: new Date(Date.now() - 1200000).toISOString(),
  },
];

interface SquadVoteContextValue {
  polls: Poll[];
  myPolls: Poll[];
  pendingPolls: Poll[];
  myVotes: Record<string, "heart" | "dislike">;
  createPoll: (outfitData: PollOutfitData, friendNames: string[]) => Promise<Poll>;
  castVote: (pollId: string, response: "heart" | "dislike") => Promise<void>;
  dismissPoll: (pollId: string) => Promise<void>;
}

const SquadVoteContext = createContext<SquadVoteContextValue | null>(null);
const STORAGE_KEY = "@lookly_squad_polls";
const VOTES_KEY = "@lookly_my_votes";

export function SquadVoteProvider({ children }: { children: React.ReactNode }) {
  const [polls, setPolls] = useState<Poll[]>(SEED_POLLS);
  const [myVotes, setMyVotes] = useState<Record<string, "heart" | "dislike">>({});

  useEffect(() => {
    (async () => {
      try {
        const [storedPolls, storedVotes] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(VOTES_KEY),
        ]);
        if (storedPolls) {
          const userPolls: Poll[] = JSON.parse(storedPolls);
          setPolls([
            ...userPolls,
            ...SEED_POLLS.filter((s) => !userPolls.find((p) => p.id === s.id)),
          ]);
        }
        if (storedVotes) {
          setMyVotes(JSON.parse(storedVotes));
        }
      } catch {}
    })();
  }, []);

  const persist = useCallback(async (next: Poll[]) => {
    const userPolls = next.filter((p) => !p.id.startsWith("seed_"));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(userPolls.map(stripPollImage))
    );
  }, []);

  const createPoll = useCallback(
    async (outfitData: PollOutfitData, friendNames: string[]): Promise<Poll> => {
      const newPoll: Poll = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        creatorId: "me",
        creatorName: "You",
        outfitData,
        sentTo: friendNames,
        votes: [],
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      const next = [newPoll, ...polls];
      setPolls(next);
      await persist(next);
      return newPoll;
    },
    [polls, persist]
  );

  const castVote = useCallback(
    async (pollId: string, response: "heart" | "dislike") => {
      const next = polls.map((p) => {
        if (p.id !== pollId) return p;
        const filtered = p.votes.filter((v) => v.friendName !== "me");
        return { ...p, votes: [...filtered, { friendName: "me", response }] };
      });
      const nextVotes = { ...myVotes, [pollId]: response };
      setPolls(next);
      setMyVotes(nextVotes);
      await Promise.all([
        persist(next),
        AsyncStorage.setItem(VOTES_KEY, JSON.stringify(nextVotes)),
      ]);
    },
    [polls, myVotes, persist]
  );

  const dismissPoll = useCallback(
    async (pollId: string) => {
      const next = polls.filter((p) => p.id !== pollId);
      setPolls(next);
      await persist(next);
    },
    [polls, persist]
  );

  const now = Date.now();
  const activePollsList = polls.filter(
    (p) => new Date(p.expiresAt).getTime() > now
  );
  const myPolls = activePollsList.filter((p) => p.creatorId === "me");
  const pendingPolls = activePollsList.filter(
    (p) =>
      p.creatorId !== "me" &&
      p.sentTo.includes("me") &&
      !myVotes[p.id]
  );

  return (
    <SquadVoteContext.Provider
      value={{ polls: activePollsList, myPolls, pendingPolls, myVotes, createPoll, castVote, dismissPoll }}
    >
      {children}
    </SquadVoteContext.Provider>
  );
}

export function useSquadVote() {
  const ctx = useContext(SquadVoteContext);
  if (!ctx) throw new Error("useSquadVote must be inside SquadVoteProvider");
  return ctx;
}

export function getTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
