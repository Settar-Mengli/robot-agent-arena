import { describe, expect, it, vi } from "vitest";
import {
  greedyCpuPolicy,
  randomCpuPolicy,
  runMatch,
  buildMatchSuite
} from "../eval";

describe("runMatch", () => {
  it("is deterministic for random and greedy", async () => {
    const scenario = buildMatchSuite("dev")[0]!;

    const randomA = await runMatch(scenario, randomCpuPolicy());
    const randomB = await runMatch(scenario, randomCpuPolicy());
    expect(randomA).toEqual(randomB);

    const greedy = greedyCpuPolicy(scenario.cpuConfig);
    const greedyA = await runMatch(scenario, greedy);
    const greedyB = await runMatch(scenario, greedyCpuPolicy(scenario.cpuConfig));
    expect(greedyA).toEqual(greedyB);
  });

  it("committed-path purity: no Date.now/Math.random on deterministic policies", async () => {
    const scenario = buildMatchSuite("dev")[1]!;
    const dateSpy = vi.spyOn(Date, "now");
    const randomSpy = vi.spyOn(Math, "random");

    await runMatch(scenario, randomCpuPolicy());
    await runMatch(scenario, greedyCpuPolicy(scenario.cpuConfig));

    expect(dateSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();
    dateSpy.mockRestore();
    randomSpy.mockRestore();
  });
});
