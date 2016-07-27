# Docker Monitoring with Icinga2 (through Icinga2 API)
## Description
This docker container read the docker.sock and can check the state of a container and also state of a process (define in labels var).

## Variables for container
    
Path to docker.sock file (bind in docker container (-v /var/run/docker.sock:/docker.sock)

    DOCKERSOCK=/docker.sock
    
IP or DNS Name of Icinga2 Server

    MONITORING_API_URL=monitorint.server.local
    
API User of Icinga2 Server
    
    MONITORING_API_USER=root
    
API User Pass of Icinga2 Server
    
    MONITORING_API_PASS=PASS

API Port of Icinga2 Server

    MONITORING_API_PORT=5665

Name of Docker Host, you need this to define, which containers will be monitor this container

    DOCKERSERVERNAME=superdocker
    
Host template of icinga2 configuration
    
    TEMPLATEHOST=passive-host

Service template of Icinga2 configuration

    TEMPLATESERVICE=passive-service

Hostgroup in Icinga2 Server

    HOSTGROUP=adito

Servicegroup in Icinga2 Server    

    SERVICEGROUP=adito
    
Time to resend notification
    
    LOOPTIME=2m
    
## docker-compose.yml

    icinga2mon:
      image: adito/docker-monitoring
      hostname: icinga2-monitoring
      environment:
        - DOCKERSOCK=/docker.sock
        - MONITORING_API_URL=monitorint.server.local
        - MONITORING_API_USER=root
        - MONITORING_API_PASS=PASS
        - MONITORING_API_PORT=5665
        - DOCKERSERVERNAME=superdocker
        - TEMPLATEHOST=passive-host
        - TEMPLATESERVICE=passive-service
        - HOSTGROUP=adito
        - SERVICEGROUP=adito
        - LOOPTIME=2m
      volumes:
        - /var/run/docker.sock:/docker.sock
      restart: always