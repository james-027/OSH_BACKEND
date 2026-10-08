import {
  STATUS_IDS,
  ACTION_IDS,
  DAYS_FACTOR_RATE,
} from "src/constants/customConstants";
import { SssConfigs } from "src/entities/SssConfig";


export class GovernmentContributionUtil {
  static computeSssShare(
    salaryRate: number,
    sssConfigs: SssConfigs[],
  ): number {
    const lookupValue =
      salaryRate * DAYS_FACTOR_RATE.DAYS;

    const sssConfig = sssConfigs.find((config) => {
      const rangeFrom = Number(config.range_from) || 0;
      const rangeTo = Number(config.range_to) || 0;

      return (
        lookupValue >= rangeFrom &&
        lookupValue <= rangeTo
      );
    });

    const withMpfEc =
      Number(sssConfig?.with_mpf_ec) || 0;

    const dailyMpfEc =
      withMpfEc / DAYS_FACTOR_RATE.DAYS;

    return dailyMpfEc;
  }

  static computePagIbigShare(
    staffSalary: any,
  ): number {
    const pagibigNumberPerc =
      Number(staffSalary?.pagibig_number_perc) || 0;

    const pagibigDailyRate =
      Math.round(
        (pagibigNumberPerc / DAYS_FACTOR_RATE.DAYS) * 100,
      ) / 100;

    return pagibigDailyRate ;
  }

  static computePhilHealthShare(
    salaryRate: number,
    staffSalary: any,
  ): number {
    const philHealthContriPerc =
      Number(staffSalary?.phil_health_contri_perc) || 0;

    const philHealthDailyRate =
      Math.round(
        ((salaryRate * (philHealthContriPerc / 100)) / 2) *
          100,
      ) / 100;

    return philHealthDailyRate;
  }
  
  static computeByGovernmentContribution(
    Rate: number,
    totalDayWorkFraction: number,
  ): number {
    const governmentRate = Rate * totalDayWorkFraction;

    return governmentRate;
  }



}