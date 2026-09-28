import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { fetchFirmsHotspots, fetchWindObservation, firmsSourceSchema, getDemoHotspots } from "./hotspots";
import { fetchNearbyAssets, getSentinelStatus } from "./context";
import { getHistoryForLocation, persistLiveHistory, saveOperatorFeedback } from "./history";
import { z } from "zod";

const bboxSchema = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  hotspots: router({
    demo: publicProcedure.query(() => getDemoHotspots()),
    wind: publicProcedure.input(z.object({ latitude: z.number(), longitude: z.number(), hotspotId: z.string().optional(), isDemo: z.boolean().default(false) })).query(({ input }) => fetchWindObservation(input.latitude, input.longitude, input.hotspotId, input.isDemo)),
    liveStatus: publicProcedure.query(() => ({
      configured: Boolean(process.env.FIRMS_MAP_KEY?.trim()),
      serverTime: new Date().toISOString(),
      source: "NASA FIRMS",
      freshness: "near-real-time",
      state: process.env.FIRMS_MAP_KEY?.trim() ? "CONNECTED" as const : "NOT_CONFIGURED" as const,
    })),
    fetchLive: publicProcedure
      .input(z.object({
        source: firmsSourceSchema.default("VIIRS_SNPP_NRT"),
        days: z.number().int().min(1).max(10).default(1),
        bbox: bboxSchema,
        apiKey: z.string().trim().min(1).max(160).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await fetchFirmsHotspots(input);
        const persistenceHotspots = result.hotspots;
        const persistence = result.state === "CONNECTED" ? await persistLiveHistory(persistenceHotspots) : { persistedDetections: 0, persistedClusters: 0 };
        return { ...result, clusteredCount: persistence.persistedClusters, persistence, persistenceSampled: result.hotspots.length < result.normalizedCount };
      }),
  }),
  context: router({
    nearbyAssets: publicProcedure.input(z.object({ latitude: z.number(), longitude: z.number(), radiusMeters: z.number().int().min(250).max(5000).default(1000), hotspotId: z.string().optional(), isDemo: z.boolean().default(false) })).query(({ input }) => fetchNearbyAssets(input.latitude, input.longitude, input.radiusMeters, input.hotspotId, input.isDemo)),
  }),
  history: router({
    forLocation: publicProcedure.input(z.object({ latitude: z.number(), longitude: z.number(), hotspotId: z.string().optional(), isDemo: z.boolean().default(false) })).query(({ input }) => { const demo = input.isDemo && input.hotspotId ? getDemoHotspots().find((hotspot) => hotspot.id === input.hotspotId) : undefined; return getHistoryForLocation(input.latitude, input.longitude, demo); }),
  }),
  sentinel: router({
    status: publicProcedure.input(z.object({ isDemo: z.boolean().default(false), latitude: z.number().optional(), longitude: z.number().optional(), hotspotId: z.string().optional() })).query(({ input }) => getSentinelStatus(input.isDemo, input.latitude, input.longitude, input.hotspotId)),
  }),
  feedback: router({
    submit: publicProcedure.input(z.object({ hotspotId: z.string().min(1), outcome: z.enum(["CONFIRMED", "REJECTED", "CORRECTED"]), comment: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => saveOperatorFeedback({ ...input, userOpenId: ctx.user?.openId })),
  }),
});

export type AppRouter = typeof appRouter;
