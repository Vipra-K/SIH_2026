# BorderSight AI

AI-powered border surveillance and situational-awareness platform for SIH 2026 Problem Statement 187.

## MVP

- Camera-agnostic video sources (demo video, local camera, future RTSP)
- Person and vehicle detection/tracking
- Virtual border/restricted zones
- Intrusion and loitering events
- Contextual risk scoring
- Incident management and investigation timeline
- Operator command-center dashboard
- Sector and camera management

## Architecture

Video Source -> Ingestion -> Detection -> Tracking -> Zone/Behaviour Engine -> Risk Engine -> Incident Engine -> Operator Dashboard

This repository contains the initial product specification and implementation scaffold. Existing SIH work can live alongside this directory without being modified.
